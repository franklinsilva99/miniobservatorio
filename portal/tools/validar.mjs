#!/usr/bin/env node
/* Valida un repositorio de productos completo: manifiesto, existencia de
   cada archivo, contrato de cada producto y coherencia de fechas.
   Uso:  node tools/validar.mjs [carpeta-del-repositorio]   (por defecto: productos/) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validarProducto, validarManifiesto, PRODUCTOS } from "../js/datos/contrato.js";
import { leerJSON } from "./lib-publicacion.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(process.argv[2] || path.join(raiz, "productos"));
let errores = 0, avisos = 0;
const mal = m => { errores++; console.error("✘ " + m); }, ojo = m => { avisos++; console.warn("! " + m); };

const mPath = path.join(repo, "manifest.json");
if (!fs.existsSync(mPath)) { mal(`No existe ${mPath}`); process.exit(1); }
let man;
try { man = leerJSON(mPath); } catch (e) { mal(`manifest.json no es JSON válido: ${e.message}`); process.exit(1); }
const vm = validarManifiesto(man);
if (!vm.ok) { vm.errores.forEach(mal); process.exit(1); }
console.log(`Repositorio: ${repo}\nManifiesto generado ${man.generado}${man.demo ? " (demostración)" : ""}`);

for (const id of PRODUCTOS) {
  const ent = man.productos.find(p => p.id === id);
  if (!ent) { ojo(`${id}: no figura en el manifiesto (el portal lo mostrará como no disponible)`); continue; }
  const f = path.join(repo, ent.url);
  if (!fs.existsSync(f)) { mal(`${id}: el manifiesto apunta a ${ent.url}, que no existe`); continue; }
  let j;
  try { j = leerJSON(f); } catch (e) { mal(`${id}: ${ent.url} no es JSON válido (${e.message})`); continue; }
  const r = validarProducto(id, j);
  if (!r.ok) { mal(`${id}: no cumple el contrato`); r.errores.forEach(x => console.error("    · " + x)); continue; }
  if (j.emitido !== ent.emitido) ojo(`${id}: «emitido» del archivo (${j.emitido}) no coincide con el manifiesto (${ent.emitido})`);
  const h = (Date.now() - Date.parse(j.emitido)) / 3600000;
  if (h * 60 > ent.frecuencia_min * 2) ojo(`${id}: emitido hace ${h.toFixed(1)} h; el portal lo marcará como desactualizado (frecuencia ${ent.frecuencia_min} min)`);
  const kb = (fs.statSync(f).size / 1024).toFixed(0);
  console.log(`✔ ${id.padEnd(17)} ${ent.url.padEnd(24)} ${kb.padStart(4)} KB · emitido ${j.emitido}`);
}
console.log(errores ? `\n${errores} error(es), ${avisos} advertencia(s)` : `\nRepositorio válido${avisos ? ` con ${avisos} advertencia(s)` : ""}.`);
process.exit(errores ? 1 : 0);
