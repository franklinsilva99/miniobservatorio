/* =====================================================================
   Publicación de productos en el repositorio (implementación de referencia)
   ---------------------------------------------------------------------
   Es lo que debe hacer cada sistema productor al generar un producto:
     1. Validar el archivo contra el contrato (mismo validador del portal).
     2. Escribirlo en el repositorio de forma ATÓMICA (archivo temporal +
        renombrar), para que el portal nunca lea un archivo a medio escribir.
     3. Actualizar manifest.json AL FINAL (también de forma atómica).
   Si el sistema productor no usa Node, debe replicar estos tres pasos
   (ver docs/contrato-datos.md, sección «Procedimiento de publicación»).
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { validarProducto, validarManifiesto, VERSION_CONTRATO, PRODUCTOS } from "../js/datos/contrato.js";

/** Ruta por defecto de cada producto dentro del repositorio. */
export const RUTA = Object.fromEntries(PRODUCTOS.map(id => { const [dom, tipo] = id.split("-"); return [id, `${dom}/${tipo}.json`]; }));
/** Frecuencia de emisión esperada (min). Sirve para detectar productos desactualizados. */
export const FRECUENCIA = { "meteo-monitoreo": 10, "hidro-monitoreo": 10, "meteo-pronostico": 720, "hidro-pronostico": 1440, "meteo-avisos": 1440, "hidro-avisos": 1440 };

/** Lee un JSON tolerando la marca BOM que agregan algunas herramientas de Windows. */
export const leerJSON = f => JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));

/** JSON legible: listas numéricas en una sola línea. */
export const aJSON = x => JSON.stringify(x, null, 2).replace(/\[(?:\s*(?:-?\d+(?:\.\d+)?(?:e-?\d+)?|null)\s*,?)+\s*\]/g, m => m.replace(/\s+/g, ""));

function escribirAtomico(destino, texto) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, texto);
  fs.renameSync(tmp, destino); // operación atómica dentro del mismo disco
}

/**
 * Publica un producto en el repositorio.
 * @param {string} repoDir carpeta raíz del repositorio (la que contiene manifest.json)
 * @param {object} json producto completo según el contrato
 * @param {{frecuencia_min?:number, demo?:boolean}} opciones
 */
export function publicar(repoDir, json, { frecuencia_min, demo } = {}) {
  const id = json?.producto, r = validarProducto(id, json);
  if (!r.ok) { const e = new Error(`El producto «${id}» no cumple el contrato:\n  · ${r.errores.join("\n  · ")}`); e.errores = r.errores; throw e; }

  const url = RUTA[id];
  escribirAtomico(path.join(repoDir, url), aJSON(json));

  const mPath = path.join(repoDir, "manifest.json");
  let man = { contrato: VERSION_CONTRATO, generado: json.emitido, productos: [] };
  if (fs.existsSync(mPath)) {
    try { man = leerJSON(mPath); } catch { /* manifiesto dañado: se reconstruye */ }
  }
  if (demo != null) man.demo = demo;
  const prev = man.productos.find(p => p.id === id);
  const ent = { id, url, emitido: json.emitido, frecuencia_min: frecuencia_min ?? prev?.frecuencia_min ?? FRECUENCIA[id] };
  man.productos = [...man.productos.filter(p => p.id !== id), ent].sort((a, b) => PRODUCTOS.indexOf(a.id) - PRODUCTOS.indexOf(b.id));
  man.generado = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  man.contrato = VERSION_CONTRATO;
  const vm = validarManifiesto(man);
  if (!vm.ok) throw new Error("Manifiesto resultante inválido: " + vm.errores.join("; "));
  escribirAtomico(mPath, aJSON(man));
  return ent;
}
