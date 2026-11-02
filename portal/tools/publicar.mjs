#!/usr/bin/env node
/* Publica uno o más productos en el repositorio, validándolos antes.
   Uso:  node tools/publicar.mjs <producto.json> [...] [--repo productos] [--frecuencia 10]
   Sale con código 1 si algún archivo no cumple el contrato (no se publica). */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicar, leerJSON } from "./lib-publicacion.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), arch = [];
let repo = path.join(raiz, "productos"), frecuencia;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--repo") repo = path.resolve(args[++i]);
  else if (args[i] === "--frecuencia") frecuencia = +args[++i];
  else arch.push(args[i]);
}
if (!arch.length) { console.error("Uso: node tools/publicar.mjs <producto.json> [...] [--repo carpeta] [--frecuencia min]"); process.exit(2); }

let fallos = 0;
for (const a of arch) {
  try {
    const json = leerJSON(a);
    const ent = publicar(repo, json, { frecuencia_min: frecuencia });
    console.log(`✔ ${ent.id} publicado en ${path.join(repo, ent.url)} (emitido ${ent.emitido})`);
  } catch (e) { fallos++; console.error(`✘ ${a}\n  ${e.message}`); }
}
process.exit(fallos ? 1 : 0);
