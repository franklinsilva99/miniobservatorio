/* Pruebas de la recepción y del modelo de vista, con la red y el navegador simulados.
   Ejecutar:  node --test "tools/pruebas/*.test.mjs" */
import test from "node:test";
import assert from "node:assert/strict";

/* ---------- navegador simulado ---------- */
const BASE = "https://portal.test/";
let archivos = {}, pedidos = [];
const almacen = new Map();
let cuotaBytes = Infinity;

globalThis.location = { href: BASE, protocol: "https:" };
globalThis.localStorage = {
  getItem: k => almacen.get(k) ?? null,
  setItem: (k, v) => { if (v.length > cuotaBytes) throw new Error("QuotaExceededError"); almacen.set(k, v); }
};
const objetivo = new EventTarget();
globalThis.dispatchEvent = e => objetivo.dispatchEvent(e);
globalThis.fetch = async url => {
  const u = new URL(url), ruta = u.pathname.slice(1);
  pedidos.push(ruta);
  if (archivos[ruta] === "caido") throw new TypeError("red");
  if (!(ruta in archivos)) return { ok: false, status: 404 };
  return { ok: true, status: 200, json: async () => structuredClone(archivos[ruta]) };
};
console.warn = () => { };

const { CONFIG } = await import("../../js/config.js");
const { repo, actualizar, iniciarRepositorio, pedirDetalle, detalleDe, salud } = await import("../../js/datos/repositorio.js");
const { M, construir } = await import("../../js/datos/modelo.js");
CONFIG.repositorio = "productos/";
CONFIG.dispersion_s = 0;

/* ---------- datos ---------- */
const hora = (h = 0) => new Date(Date.now() - h * 3600000).toISOString().replace(/\.\d+Z$/, "Z");
const emitido = hora();
const estacion = (id, extra = {}) => ({ id, nombre: id, lat: -12, lon: -76, tipo_umbral: "avenida", actual: { fecha: hora(1), caudal: 50, nivel: 1 }, umbrales: { caudal: [10, 20, 30] }, ...extra });
const monitoreo = (lista, extra = {}) => ({ contrato: "1.1", producto: "hidro-monitoreo", emitido, fuente: "S", datos: { estaciones: lista }, ...extra });
const manifiesto = (entradas, demo = false) => ({ contrato: "1.1", generado: emitido, demo, productos: entradas });
const entrada = (id, url, em = emitido) => ({ id, url, emitido: em, frecuencia_min: 60 });

function reiniciar(config = ["hidro/manifest.json"]) {
  archivos = {}; pedidos = []; cuotaBytes = Infinity; almacen.clear();
  CONFIG.manifiestos = config;
  Object.values(repo.productos).forEach(P => Object.assign(P, { json: null, emitido: null, url: null, omitidos: 0, error: null, errores: null, sinConexion: false, noPublicado: false, frecuencia_min: null }));
  repo.conexion = "pendiente"; repo.errorManifiesto = null; repo.manifiesto = null;
}
const publicarHidro = (lista, extra) => {
  archivos["productos/hidro/manifest.json"] = manifiesto([entrada("hidro-monitoreo", "monitoreo.json")]);
  archivos["productos/hidro/monitoreo.json"] = monitoreo(lista, extra);
};

test("cada sistema publica su manifiesto y las rutas son relativas a él", async () => {
  reiniciar(["hidro/manifest.json", "manifest.json"]);
  publicarHidro([estacion("a")]);
  archivos["productos/manifest.json"] = manifiesto([entrada("meteo-avisos", "meteo/avisos.json")]);
  archivos["productos/meteo/avisos.json"] = { contrato: "1.0", producto: "meteo-avisos", emitido, fuente: "S", datos: { avisos: [] } };
  await actualizar();
  assert.equal(repo.conexion, "ok");
  assert.equal(repo.productos["hidro-monitoreo"].json.datos.estaciones.length, 1);
  assert.equal(repo.productos["meteo-avisos"].json.producto, "meteo-avisos");
  assert.ok(pedidos.includes("productos/hidro/monitoreo.json"));
});

test("si cae un manifiesto, los productos del otro siguen", async () => {
  reiniciar(["hidro/manifest.json", "manifest.json"]);
  publicarHidro([estacion("a")]);
  archivos["productos/manifest.json"] = "caido";
  await actualizar();
  assert.equal(repo.conexion, "ok");
  assert.equal(salud("hidro-monitoreo").nivel, "ok");
  assert.equal(repo.productos["meteo-avisos"].noPublicado, false);
  assert.equal(repo.productos["meteo-avisos"].sinConexion, true);
});

test("si caen todos, queda sin conexión y se conserva lo recibido", async () => {
  reiniciar();
  publicarHidro([estacion("a")]);
  await actualizar();
  archivos["productos/hidro/manifest.json"] = "caido";
  await actualizar();
  assert.equal(repo.conexion, "sin_conexion");
  assert.equal(salud("hidro-monitoreo").nivel, "sin_conexion");
  assert.ok(repo.productos["hidro-monitoreo"].json);
});

test("un producto no se vuelve a descargar si su emisión no cambió", async () => {
  reiniciar();
  publicarHidro([estacion("a")]);
  await actualizar();
  pedidos = [];
  await actualizar();
  assert.deepEqual(pedidos, ["productos/hidro/manifest.json"]);
});

test("se omite el elemento malo y se suma lo que declara el productor", async () => {
  reiniciar();
  const lista = Array.from({ length: 10 }, (_, i) => estacion(`e${i}`));
  delete lista[0].nombre;
  publicarHidro(lista, { omitidos: 2 });
  await actualizar();
  const P = repo.productos["hidro-monitoreo"];
  assert.equal(P.json.datos.estaciones.length, 9);
  assert.equal(P.omitidos, 3);
});

test("un archivo inválido conserva la versión anterior", async () => {
  reiniciar();
  publicarHidro([estacion("a")]);
  await actualizar();
  const otra = hora(-1);
  archivos["productos/hidro/manifest.json"] = manifiesto([entrada("hidro-monitoreo", "monitoreo.json", otra)]);
  archivos["productos/hidro/monitoreo.json"] = { contrato: "1.1", producto: "hidro-monitoreo", emitido: otra, fuente: "S", datos: { estaciones: "mal" } };
  await actualizar();
  assert.equal(salud("hidro-monitoreo").nivel, "rechazado");
  assert.equal(repo.productos["hidro-monitoreo"].json.datos.estaciones[0].id, "a");
});

test("el detalle se pide al abrir la estación, una sola vez, y avisa al llegar", async () => {
  reiniciar();
  publicarHidro([estacion("a", { detalle: "estaciones/a.json" })]);
  archivos["productos/hidro/estaciones/a.json"] = { contrato: "1.1", producto: "hidro-monitoreo-detalle", id: "a", emitido, serie: { inicio: hora(2), paso_min: 60, caudal: [1, 2] } };
  await actualizar();
  assert.ok(!pedidos.includes("productos/hidro/estaciones/a.json"), "no debe bajar el detalle con el resumen");

  const llego = new Promise(r => objetivo.addEventListener("pc:detalle", r, { once: true }));
  assert.equal(pedirDetalle("hidro-monitoreo", "a", "estaciones/a.json"), "cargando");
  await llego;
  assert.equal(pedirDetalle("hidro-monitoreo", "a", "estaciones/a.json"), "ok");
  assert.equal(pedidos.filter(p => p.endsWith("estaciones/a.json")).length, 1);
  assert.deepEqual(detalleDe("hidro-monitoreo", "a").serie.caudal, [1, 2]);

  construir();
  assert.deepEqual(M.HS("a").serQ, [1, 2]);
});

test("el detalle de otra estación se rechaza", async () => {
  reiniciar();
  publicarHidro([estacion("b", { detalle: "estaciones/b.json" })]);
  archivos["productos/hidro/estaciones/b.json"] = { contrato: "1.1", producto: "hidro-monitoreo-detalle", id: "otra", emitido, serie: { inicio: hora(2), paso_min: 60, caudal: [1] } };
  await actualizar();
  const llego = new Promise(r => objetivo.addEventListener("pc:detalle", r, { once: true }));
  pedirDetalle("hidro-monitoreo", "b", "estaciones/b.json");
  await llego;
  assert.equal(pedirDetalle("hidro-monitoreo", "b", "estaciones/b.json"), "error");
});

test("la copia local se recupera y, sin espacio, se guarda sin series", async () => {
  reiniciar();
  const serie = { inicio: hora(100), paso_min: 60, caudal: Array(2000).fill(1) };
  publicarHidro([estacion("a", { serie })]);
  cuotaBytes = 2000;
  await actualizar();
  const copia = JSON.parse(almacen.get("pc:v1:hidro-monitoreo"));
  assert.equal(copia.json.datos.estaciones[0].serie, undefined);

  repo.productos["hidro-monitoreo"].json = null;
  iniciarRepositorio();
  assert.equal(repo.productos["hidro-monitoreo"].json.datos.estaciones[0].id, "a");
});

/* ---------- modelo de vista ---------- */
async function modeloDe(lista) {
  reiniciar();
  publicarHidro(lista);
  await actualizar();
  construir();
}

test("el estado enviado por el productor manda sobre los umbrales", async () => {
  await modeloDe([estacion("a", { estado: "normal" }), estacion("b", { estado: "extrema", actual: { fecha: hora(1), caudal: 1 } })]);
  assert.equal(M.HS("a").s, 1);
  assert.equal(M.HS("b").s, 4);
});

test("sin estado enviado se calcula por umbrales", async () => {
  await modeloDe([estacion("a"), estacion("b", { actual: { fecha: hora(1), caudal: 15 } })]);
  assert.equal(M.HS("a").s, 4);
  assert.equal(M.HS("b").s, 2);
});

test("estación sin datos: gris y sin fecha", async () => {
  await modeloDe([estacion("a", { estado: "sin_datos", actual: { fecha: null, caudal: null, nivel: null } })]);
  assert.equal(M.HS("a").s, 0);
  assert.equal(M.HS("a").viejo, false);
});

test("dato viejo: gris si está normal, pero conserva el color si tiene aviso", async () => {
  const vieja = { fecha: hora(72), caudal: 5 };
  await modeloDe([estacion("a", { estado: "normal", actual: vieja }), estacion("b", { estado: "fuerte", actual: vieja })]);
  assert.equal(M.HS("a").s, 0);
  assert.equal(M.HS("a").viejo, true);
  assert.equal(M.HS("b").s, 3);
});

test("estación solo con nivel: se evalúa con sus umbrales de nivel", async () => {
  await modeloDe([estacion("a", { variables: ["nivel"], umbrales: { nivel: [1, 2, 3] }, actual: { fecha: hora(1), nivel: 2.5 } })]);
  assert.equal(M.HS("a").s, 3);
  assert.equal(M.HS("a").q, null);
  assert.equal(M.HS("a").niv, 2.5);
});

test("estación sin umbrales: normal si tiene dato", async () => {
  await modeloDe([estacion("a", { umbrales: undefined, actual: { fecha: hora(1), caudal: 5 } })]);
  assert.equal(M.HS("a").s, 1);
  assert.equal(M.HS("a").u, null);
});

test("pronóstico con modelos incompletos promedia solo los que tienen valor", async () => {
  reiniciar();
  archivos["productos/hidro/manifest.json"] = manifiesto([entrada("hidro-pronostico", "pronostico.json")]);
  archivos["productos/hidro/pronostico.json"] = {
    contrato: "1.1", producto: "hidro-pronostico", emitido, fuente: "S", datos: {
      estaciones: [{
        id: "a", nombre: "A", lat: -12, lon: -76, tipo_umbral: "avenida",
        pronostico: { fechas: ["2026-11-03", "2026-11-04"], modelos: [{ nombre: "M1", caudal: [10, null] }, { nombre: "M2", caudal: [20, null] }] }
      }]
    }
  };
  await actualizar();
  construir();
  const f = M.HFC.a;
  assert.deepEqual(f.avg, [15, null]);
  assert.equal(f.pico, 15);
  assert.equal(f.s, 1);
});
