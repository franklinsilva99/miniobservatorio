/* =====================================================================
   Repositorio de productos — cómo el portal RECIBE los productos
   ---------------------------------------------------------------------
   1. Lee los manifiestos (un sistema productor puede tener el suyo).
   2. Descarga solo los productos cuya emisión cambió.
   3. Valida cada archivo contra el contrato: un elemento con errores se
      omite; un archivo inválido se rechaza y se conserva la versión
      anterior (nunca deja el mosaico en blanco).
   4. Guarda la última versión válida en el navegador para mostrarla al
      instante en la próxima visita o si el repositorio no responde.
   5. Descarga el detalle de una estación solo cuando se abre.
   ===================================================================== */
import { CONFIG } from "../config.js";
import { PRODUCTOS, validarProducto, validarDetalle, validarManifiesto } from "./contrato.js";

const LS = "pc:v1:";
const MAX_DETALLES = 50;

/** Estado observable del repositorio. */
export const repo = {
  conexion: "pendiente",   // pendiente | ok | sin_conexion | error
  errorManifiesto: null,
  manifiesto: null,
  verificado: null,        // Date de la última consulta a los manifiestos
  productos: Object.fromEntries(PRODUCTOS.map(id => [id, {
    id, json: null, emitido: null, frecuencia_min: null, recibido: null, url: null, omitidos: 0,
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
const omitidosDe = (json, r) => (json.omitidos || 0) + r.omitidos.length;

function leerCopiaLocal() {
  for (const id of PRODUCTOS) {
    try {
      const c = JSON.parse(localStorage.getItem(LS + id) || "null");
      const r = c && validarProducto(id, c.json);
      if (r?.ok) Object.assign(repo.productos[id], { json: r.json, emitido: r.json.emitido, frecuencia_min: c.frecuencia_min ?? null, omitidos: omitidosDe(r.json, r), desdeCache: true });
    } catch { /* almacenamiento no disponible o copia corrupta: se ignora */ }
  }
}

/** Sin las series, que son lo más pesado: basta para seguir viendo el estado de las estaciones. */
function sinSeries(json) {
  if (!Array.isArray(json.datos.estaciones)) return json;
  return { ...json, datos: { ...json.datos, estaciones: json.datos.estaciones.map(({ serie, ...e }) => e) } };
}

function guardarCopiaLocal(id) {
  const P = repo.productos[id], guardar = json => localStorage.setItem(LS + id, JSON.stringify({ json, frecuencia_min: P.frecuencia_min }));
  try { guardar(P.json); }
  catch {
    try { guardar(sinSeries(P.json)); } catch { /* sin espacio o bloqueado */ }
  }
}

/** Carga inmediata desde la copia local (antes de tocar la red). */
export function iniciarRepositorio() { leerCopiaLocal(); }

/* ---------- manifiestos ---------- */
async function leerManifiestos() {
  const rutas = CONFIG.manifiestos;
  const leidos = await Promise.allSettled(rutas.map(async ruta => {
    const url = new URL(ruta, base()).href, man = await traer(url), vm = validarManifiesto(man);
    if (!vm.ok) { console.warn(`[repositorio] manifiesto ${ruta} inválido`, vm.errores); throw new FalloDescarga(`rechazado: ${vm.errores[0]}`, "formato"); }
    return { ruta, url, man };
  }));
  const ok = leidos.filter(l => l.status === "fulfilled").map(l => l.value);
  const fallos = leidos.map((l, i) => l.status === "rejected" ? { ruta: rutas[i], error: l.reason } : null).filter(Boolean);
  return { ok, fallos };
}

const espera = ms => new Promise(r => setTimeout(r, ms));

/**
 * Consulta los manifiestos y descarga lo que haya cambiado.
 * @param {{repartir?:boolean}} o repartir: espera un tiempo al azar antes de descargar una emisión
 *   nueva, para que todos los navegadores no la pidan a la vez.
 * @returns {Promise<boolean>} true si algún producto cambió.
 */
export async function actualizar({ repartir = false } = {}) {
  repo.verificado = new Date();
  const { ok, fallos } = await leerManifiestos();
  const textoFallo = f => `No se pudo leer ${f.ruta}: ${f.error.message}`;

  if (!ok.length) {
    const red = fallos.some(f => f.error.tipo === "red");
    repo.conexion = red ? "sin_conexion" : "error";
    repo.errorManifiesto = textoFallo(fallos[0]);
    PRODUCTOS.forEach(id => repo.productos[id].sinConexion = red);
    return true; // cambia el estado visible aunque no cambien los datos
  }
  repo.conexion = "ok";
  repo.errorManifiesto = fallos.length ? textoFallo(fallos[0]) : null;
  repo.manifiesto = { demo: ok.some(m => m.man.demo), productos: ok.flatMap(m => m.man.productos) };

  /* El primer manifiesto que declara un producto es el que manda. */
  const entradas = new Map();
  ok.forEach(({ url, man }) => man.productos.forEach(e => { if (!entradas.has(e.id)) entradas.set(e.id, { ...e, url: new URL(e.url, url).href }); }));

  const cambiaron = id => { const e = entradas.get(id), P = repo.productos[id]; return e && !(P.json && P.emitido === e.emitido); };
  const hayCopia = PRODUCTOS.filter(cambiaron).some(id => repo.productos[id].json);
  if (repartir && hayCopia && CONFIG.dispersion_s > 0) await espera(Math.random() * CONFIG.dispersion_s * 1000);

  let cambios = false;
  await Promise.all(PRODUCTOS.map(async id => {
    const P = repo.productos[id], ent = entradas.get(id);
    const antes = JSON.stringify([P.error, P.sinConexion, P.noPublicado]);
    P.sinConexion = false;
    if (!ent) {
      /* Puede estar en el manifiesto que no respondió: entonces no es que no se haya publicado. */
      P.noPublicado = !fallos.length; P.sinConexion = fallos.some(f => f.error.tipo === "red");
      P.error = fallos.length ? textoFallo(fallos[0]) : "No figura en el manifiesto";
    }
    else {
      P.noPublicado = false; P.frecuencia_min = ent.frecuencia_min; P.url = ent.url;
      if (P.json && P.emitido === ent.emitido) { P.error = null; P.desdeCache = false; }
      else {
        try {
          const u = new URL(ent.url);
          u.searchParams.set("v", ent.emitido); // evita copias intermedias desactualizadas
          const j = await traer(u.href), r = validarProducto(id, j);
          if (!r.ok) {
            P.error = "Archivo rechazado por no cumplir el contrato"; P.errores = r.errores;
            console.warn(`[repositorio] ${id} rechazado`, r.errores);
          } else if (P.json && Date.parse(j.emitido) < Date.parse(P.emitido)) {
            P.error = null; // versión más antigua que la que ya se tiene: se ignora
          } else {
            if (r.omitidos.length) console.warn(`[repositorio] ${id}: ${r.omitidos.length} de ${r.total} elementos omitidos`, r.errores);
            Object.assign(P, { json: r.json, emitido: r.json.emitido, recibido: new Date(), omitidos: omitidosDe(r.json, r), error: null, errores: null, desdeCache: false });
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

/* ---------- detalle de una estación: se pide al abrirla ---------- */
const detalles = new Map(); // clave producto|emisión|estación → {estado: cargando|ok|error, json}

const claveDetalle = (id, estacion) => `${id}|${repo.productos[id].emitido}|${estacion}`;

/** Detalle ya recibido de la estación, o undefined si aún no está. */
export function detalleDe(id, estacion) {
  const d = detalles.get(claveDetalle(id, estacion));
  return d?.estado === "ok" ? d.json : undefined;
}

/**
 * Pide el detalle si hace falta y avisa con el evento «pc:detalle» cuando termina.
 * @returns {"ok"|"cargando"|"error"} en qué va.
 */
export function pedirDetalle(id, estacion, ruta) {
  const P = repo.productos[id], clave = claveDetalle(id, estacion), actual = detalles.get(clave);
  if (actual && (actual.estado !== "error" || Date.now() - actual.en < 60000)) return actual.estado;
  if (!P.url) { detalles.set(clave, { estado: "error", en: Date.now() }); return "error"; } // copia local sin conexión

  detalles.set(clave, { estado: "cargando" });
  if (detalles.size > MAX_DETALLES) detalles.delete(detalles.keys().next().value);
  (async () => {
    try {
      const u = new URL(ruta, P.url);
      u.searchParams.set("v", P.emitido);
      const json = await traer(u.href), r = validarDetalle(json);
      if (!r.ok || json.id !== estacion) throw new Error(r.errores[0] || "el detalle es de otra estación");
      detalles.set(clave, { estado: "ok", json });
    } catch (e) {
      console.warn(`[repositorio] detalle de ${estacion}: ${e.message}`);
      detalles.set(clave, { estado: "error", en: Date.now() });
    }
    dispatchEvent(new Event("pc:detalle"));
  })();
  return "cargando";
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
