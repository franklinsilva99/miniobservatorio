/* =====================================================================
   Repositorio de productos — cómo el portal RECIBE los productos
   ---------------------------------------------------------------------
   1. Lee manifest.json (lista de productos publicados y su fecha de emisión).
   2. Descarga solo los productos cuya emisión cambió.
   3. Valida cada archivo contra el contrato; si es inválido lo rechaza y
      conserva la versión anterior (nunca deja el mosaico en blanco).
   4. Guarda la última versión válida en el navegador para mostrarla al
      instante en la próxima visita o si el repositorio no responde.
   ===================================================================== */
import { CONFIG } from "../config.js";
import { PRODUCTOS, validarProducto, validarManifiesto } from "./contrato.js";

const LS = "pc:v1:";

/** Estado observable del repositorio. */
export const repo = {
  conexion: "pendiente",   // pendiente | ok | sin_conexion | error
  errorManifiesto: null,
  manifiesto: null,
  verificado: null,        // Date de la última consulta al manifiesto
  productos: Object.fromEntries(PRODUCTOS.map(id => [id, {
    id, json: null, emitido: null, frecuencia_min: null, recibido: null,
    error: null, errores: null, sinConexion: false, desdeCache: false, noPublicado: false
  }]))
};

const base = () => new URL(CONFIG.repositorio, location.href);
/** Resuelve una ruta del repositorio (p. ej. la de un PDF de aviso). Solo admite http(s). */
export function urlRepositorio(rel) {
  try { const u = new URL(rel, base()); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
}

class FalloDescarga extends Error { constructor(msg, tipo) { super(msg); this.tipo = tipo; } }
async function traer(url) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), CONFIG.timeout_ms);
  let r;
  try { r = await fetch(url, { cache: "no-cache", signal: ac.signal }); }
  catch (e) { throw new FalloDescarga(e.name === "AbortError" ? "tiempo de espera agotado" : "sin respuesta del servidor", "red"); }
  finally { clearTimeout(t); }
  if (!r.ok) throw new FalloDescarga(`HTTP ${r.status}`, r.status >= 500 ? "red" : "http");
  try { return await r.json(); } catch { throw new FalloDescarga("el archivo no es JSON válido", "formato"); }
}

/* ---------- copia local de la última versión válida ---------- */
function leerCopiaLocal() {
  for (const id of PRODUCTOS) {
    try {
      const c = JSON.parse(localStorage.getItem(LS + id) || "null");
      if (c && validarProducto(id, c.json).ok) Object.assign(repo.productos[id], { json: c.json, emitido: c.json.emitido, frecuencia_min: c.frecuencia_min ?? null, desdeCache: true });
    } catch { /* almacenamiento no disponible o copia corrupta: se ignora */ }
  }
}
function guardarCopiaLocal(id) {
  const P = repo.productos[id];
  try { localStorage.setItem(LS + id, JSON.stringify({ json: P.json, frecuencia_min: P.frecuencia_min })); } catch { /* sin espacio o bloqueado */ }
}

/** Carga inmediata desde la copia local (antes de tocar la red). */
export function iniciarRepositorio() { leerCopiaLocal(); }

/**
 * Consulta el manifiesto y descarga lo que haya cambiado.
 * @returns {Promise<boolean>} true si algún producto cambió.
 */
export async function actualizar() {
  repo.verificado = new Date();
  let man;
  try { man = await traer(new URL("manifest.json", base()).href); }
  catch (e) {
    repo.conexion = e.tipo === "red" ? "sin_conexion" : "error";
    repo.errorManifiesto = `No se pudo leer el manifiesto: ${e.message}`;
    PRODUCTOS.forEach(id => repo.productos[id].sinConexion = repo.conexion === "sin_conexion");
    return true; // cambia el estado visible aunque no cambien los datos
  }
  const vm = validarManifiesto(man);
  if (!vm.ok) {
    repo.conexion = "error"; repo.errorManifiesto = `Manifiesto rechazado: ${vm.errores[0]}`;
    console.warn("[repositorio] manifiesto inválido", vm.errores);
    return true;
  }
  repo.conexion = "ok"; repo.errorManifiesto = null; repo.manifiesto = man;

  let cambios = false;
  await Promise.all(PRODUCTOS.map(async id => {
    const P = repo.productos[id], ent = man.productos.find(p => p.id === id);
    const antes = JSON.stringify([P.error, P.sinConexion, P.noPublicado]);
    P.sinConexion = false;
    if (!ent) { P.noPublicado = true; P.error = "No figura en el manifiesto"; }
    else {
      P.noPublicado = false; P.frecuencia_min = ent.frecuencia_min;
      if (P.json && P.emitido === ent.emitido) { P.error = null; P.desdeCache = false; }
      else {
        try {
          const u = new URL(ent.url, base());
          u.searchParams.set("v", ent.emitido); // evita copias intermedias desactualizadas
          const j = await traer(u.href), r = validarProducto(id, j);
          if (!r.ok) {
            P.error = "Archivo rechazado por no cumplir el contrato"; P.errores = r.errores;
            console.warn(`[repositorio] ${id} rechazado`, r.errores);
          } else if (P.json && Date.parse(j.emitido) < Date.parse(P.emitido)) {
            P.error = null; // versión más antigua que la que ya se tiene: se ignora
          } else {
            Object.assign(P, { json: j, emitido: j.emitido, recibido: new Date(), error: null, errores: null, desdeCache: false });
            guardarCopiaLocal(id); cambios = true;
          }
        } catch (e) {
          P.error = `No se pudo descargar: ${e.message}`;
          P.sinConexion = e.tipo === "red";
        }
      }
    }
    if (JSON.stringify([P.error, P.sinConexion, P.noPublicado]) !== antes) cambios = true;
  }));
  return cambios;
}

/**
 * Salud de un producto para mostrarla en el mosaico.
 * nivel: ok | verificando | desactualizado | sin_conexion | rechazado | no_disponible | cargando
 */
export function salud(id, ahora = Date.now()) {
  const P = repo.productos[id];
  if (!P.json) {
    if (repo.conexion === "pendiente") return { nivel: "cargando", texto: "Cargando…" };
    return { nivel: "no_disponible", texto: P.error || repo.errorManifiesto || "Sin datos" };
  }
  if (repo.conexion === "pendiente") return { nivel: "verificando", texto: "Copia local · verificando si hay una emisión más reciente" };
  if (P.sinConexion || repo.conexion !== "ok") return { nivel: "sin_conexion", texto: "Sin conexión con el repositorio · se muestra la última versión recibida" };
  if (P.error) return { nivel: "rechazado", texto: `${P.error} · se mantiene la versión anterior` };
  if (P.frecuencia_min && ahora - Date.parse(P.emitido) > P.frecuencia_min * 60000 * CONFIG.tolerancia) return { nivel: "desactualizado", texto: "Desactualizado: no llegó la emisión esperada" };
  return { nivel: "ok", texto: "Al día" };
}
