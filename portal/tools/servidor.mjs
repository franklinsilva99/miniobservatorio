#!/usr/bin/env node
/* Servidor estático mínimo para probar el portal en local (sin dependencias).
   Uso:  node tools/servidor.mjs [puerto]      → http://localhost:8080
   En producción el portal se sirve con cualquier servidor web (Nginx, Apache, IIS)
   o un CDN: son archivos estáticos. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puerto = +process.argv[2] || 8080;
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".pdf": "application/pdf", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8" };

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  if (rel.endsWith("/")) rel += "index.html";
  const f = path.join(raiz, path.normalize(rel));
  const seg = path.relative(raiz, f).split(path.sep);
  if (!f.startsWith(raiz + path.sep) || seg[0] === "tools" || seg.some(s => s.startsWith("."))) { res.writeHead(403).end("Prohibido"); return; }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No encontrado"); return; }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(buf);
  });
  console.log(`${new Date().toLocaleTimeString()} ${req.method} ${rel}`);
}).on("error", e => {
  console.error(e.code === "EADDRINUSE" ? `El puerto ${puerto} está ocupado por otro programa. Use otro: node tools/servidor.mjs ${puerto + 1}` : e.message);
  process.exit(1);
}).listen(puerto, () => console.log(`Portal de Contingencia en http://localhost:${puerto}  (Ctrl+C para detener)`));
