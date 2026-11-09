#!/usr/bin/env node
/* Valida un repositorio de productos completo: manifiestos, existencia de cada
   archivo, contrato de cada producto, sus archivos de detalle y coherencia de fechas.
   Cada sistema productor puede tener su manifiesto: se revisan manifest.json en la
   raíz y en las carpetas hidro/ y meteo/.
   Uso:  node tools/validar.mjs [carpeta-del-repositorio]   (por defecto: productos/) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validarProducto, validarDetalle, validarManifiesto, PRODUCTOS } from "../js/datos/contrato.js";
import { leerJSON } from "./lib-publicacion.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(process.argv[2] || path.join(raiz, "productos"));
let errores = 0, avisos = 0;
const mal = m => { errores++; console.error("✘ " + m); }, ojo = m => { avisos++; console.warn("! " + m); };

const candidatos = ["manifest.json", "hidro/manifest.json", "meteo/manifest.json"].filter(r => fs.existsSync(path.join(repo, r)));
if (!candidatos.length) { mal(`No hay ningún manifest.json en ${repo}`); process.exit(1); }
console.log(`Repositorio: ${repo}`);

const vistos = new Set();
for (const rel of candidatos) {
  let man;
  try { man = leerJSON(path.join(repo, rel)); } catch (e) { mal(`${rel} no es JSON válido: ${e.message}`); continue; }
  const vm = validarManifiesto(man);
  if (!vm.ok) { vm.errores.forEach(x => mal(`${rel}: ${x}`)); continue; }
  console.log(`\n${rel}: generado ${man.generado}${man.demo ? " (demostración)" : ""}`);
  const dir = path.dirname(path.join(repo, rel));

  for (const ent of man.productos) {
    const { id } = ent;
    if (vistos.has(id)) ojo(`${id}: figura en más de un manifiesto; manda el primero de la configuración del portal`);
    vistos.add(id);
    const f = path.join(dir, ent.url);
    if (!fs.existsSync(f)) { mal(`${id}: el manifiesto apunta a ${ent.url}, que no existe`); continue; }
    let j;
    try { j = leerJSON(f); } catch (e) { mal(`${id}: ${ent.url} no es JSON válido (${e.message})`); continue; }
    const r = validarProducto(id, j);
    if (!r.ok) { mal(`${id}: no cumple el contrato`); r.errores.forEach(x => console.error("    · " + x)); continue; }
    r.omitidos.forEach(o => { ojo(`${id}: se omitiría el elemento ${o.id ?? "en la posición " + o.indice}`); o.errores.forEach(x => console.warn("    · " + x)); });
    if (j.omitidos) ojo(`${id}: el productor declara ${j.omitidos} elemento(s) omitido(s) en esta emisión`);
    if (j.emitido !== ent.emitido) ojo(`${id}: «emitido» del archivo (${j.emitido}) no coincide con el manifiesto (${ent.emitido})`);
    const h = (Date.now() - Date.parse(j.emitido)) / 3600000;
    if (h * 60 > ent.frecuencia_min * 2) ojo(`${id}: emitido hace ${h.toFixed(1)} h; el portal lo marcará como desactualizado (frecuencia ${ent.frecuencia_min} min)`);

    /* Archivos de detalle que el portal pedirá al abrir cada estación */
    let detalles = 0;
    for (const e of j.datos.estaciones?.filter(x => x.detalle) || []) {
      const fd = path.join(path.dirname(f), e.detalle);
      if (!fs.existsSync(fd)) { mal(`${id}: la estación ${e.id} apunta a ${e.detalle}, que no existe`); continue; }
      let d;
      try { d = leerJSON(fd); } catch (x) { mal(`${id}: ${e.detalle} no es JSON válido (${x.message})`); continue; }
      const rd = validarDetalle(d);
      if (!rd.ok) { mal(`${id}: ${e.detalle} no cumple el contrato`); rd.errores.forEach(x => console.error("    · " + x)); continue; }
      if (d.id !== e.id) { mal(`${id}: ${e.detalle} es de la estación ${d.id}, no de ${e.id}`); continue; }
      detalles++;
    }
    const kb = (fs.statSync(f).size / 1024).toFixed(0);
    console.log(`✔ ${id.padEnd(17)} ${ent.url.padEnd(24)} ${kb.padStart(4)} KB · ${String(r.total - r.omitidos.length).padStart(4)} elementos${detalles ? ` · ${detalles} detalles` : ""} · emitido ${j.emitido}`);
  }
}
PRODUCTOS.filter(id => !vistos.has(id)).forEach(id => ojo(`${id}: no figura en ningún manifiesto (el portal lo mostrará como no disponible)`));
console.log(errores ? `\n${errores} error(es), ${avisos} advertencia(s)` : `\nRepositorio válido${avisos ? ` con ${avisos} advertencia(s)` : ""}.`);
process.exit(errores ? 1 : 0);
