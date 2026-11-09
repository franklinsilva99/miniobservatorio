/* Pruebas del contrato de datos. Ejecutar:  node --test "tools/pruebas/*.test.mjs" */
import test from "node:test";
import assert from "node:assert/strict";
import { validarProducto, validarDetalle } from "../../js/datos/contrato.js";

const ahora = "2026-11-02T10:00:00-05:00";
const estacion = (id, extra = {}) => ({
  id, nombre: `Estación ${id}`, lat: -12, lon: -76, tipo_umbral: "avenida",
  actual: { fecha: ahora, caudal: 10, nivel: 1 }, ...extra
});
const monitoreo = estaciones => ({ contrato: "1.1", producto: "hidro-monitoreo", emitido: ahora, fuente: "SENAMHI", datos: { estaciones } });
const estaciones = n => Array.from({ length: n }, (_, i) => estacion(`e${i}`));

test("una estación sin datos no es inválida: valores y fecha en null", () => {
  const r = validarProducto("hidro-monitoreo", monitoreo([estacion("a", { actual: { fecha: null, caudal: null, nivel: null } })]));
  assert.equal(r.ok, true);
  assert.equal(r.omitidos.length, 0);
});

test("una estación solo con nivel es válida", () => {
  const r = validarProducto("hidro-monitoreo", monitoreo([estacion("a", {
    variables: ["nivel"], umbrales: { nivel: [1, 2, 3] }, actual: { fecha: ahora, nivel: 1.5 }
  })]));
  assert.equal(r.ok, true);
  assert.equal(r.omitidos.length, 0);
});

test("un elemento mal armado se omite y los demás se conservan", () => {
  const lista = estaciones(10);
  delete lista[3].nombre;
  const r = validarProducto("hidro-monitoreo", monitoreo(lista));
  assert.equal(r.ok, true);
  assert.equal(r.omitidos.length, 1);
  assert.equal(r.omitidos[0].id, "e3");
  assert.equal(r.json.datos.estaciones.length, 9);
  assert.ok(!r.json.datos.estaciones.some(e => e.id === "e3"));
});

test("umbrales en mal orden omiten solo esa estación", () => {
  const lista = estaciones(5);
  lista[0].umbrales = { caudal: [30, 20, 10] };
  const r = validarProducto("hidro-monitoreo", monitoreo(lista));
  assert.equal(r.ok, true);
  assert.equal(r.omitidos[0].id, "e0");
});

test("hasta el 20 % de omitidos se tolera; por encima se rechaza todo", () => {
  const conErrores = (n, malos) => { const l = estaciones(n); for (let i = 0; i < malos; i++) delete l[i].lat; return monitoreo(l); };
  assert.equal(validarProducto("hidro-monitoreo", conErrores(10, 2)).ok, true);
  const r = validarProducto("hidro-monitoreo", conErrores(10, 3));
  assert.equal(r.ok, false);
  assert.equal(r.json, null);
  assert.match(r.errores[0], /3 de 10/);
});

test("en una lista corta, un solo error no rechaza el archivo", () => {
  const l = estaciones(3);
  delete l[0].lat;
  assert.equal(validarProducto("hidro-monitoreo", monitoreo(l)).ok, true);
});

test("un archivo dañado se rechaza completo", () => {
  assert.equal(validarProducto("hidro-monitoreo", { contrato: "1.1", producto: "hidro-monitoreo" }).ok, false);
  assert.equal(validarProducto("hidro-monitoreo", monitoreo("no es lista")).ok, false);
  assert.equal(validarProducto("hidro-monitoreo", { ...monitoreo(estaciones(1)), contrato: "2.0" }).ok, false);
  assert.equal(validarProducto("hidro-monitoreo", { ...monitoreo(estaciones(1)), producto: "hidro-avisos" }).ok, false);
});

test("monitoreo sin ninguna estación válida se rechaza; avisos vacíos son válidos", () => {
  assert.equal(validarProducto("hidro-monitoreo", monitoreo([])).ok, false);
  assert.equal(validarProducto("hidro-avisos", { contrato: "1.1", producto: "hidro-avisos", emitido: ahora, fuente: "S", datos: { avisos: [] } }).ok, true);
});

test("el producto acepta contratos 1.x anteriores", () => {
  assert.equal(validarProducto("hidro-monitoreo", { ...monitoreo(estaciones(1)), contrato: "1.0" }).ok, true);
});

test("el detalle no admite rutas fuera del repositorio", () => {
  for (const detalle of ["../secreto.json", "https://otro.sitio/x.json", "/raiz.json", "estaciones/a.txt"]) {
    const l = estaciones(5);
    l[0].detalle = detalle;
    assert.equal(validarProducto("hidro-monitoreo", monitoreo(l)).omitidos.length, 1, detalle);
  }
  const l = estaciones(1);
  l[0].detalle = "estaciones/e0.json";
  assert.equal(validarProducto("hidro-monitoreo", monitoreo(l)).omitidos.length, 0);
});

test("pronóstico: modelos con días faltantes en null y sin observado ni umbrales", () => {
  const r = validarProducto("hidro-pronostico", {
    contrato: "1.1", producto: "hidro-pronostico", emitido: ahora, fuente: "S", datos: {
      estaciones: [{
        id: "a", nombre: "A", lat: -12, lon: -76, tipo_umbral: "avenida",
        pronostico: { fechas: ["2026-11-03", "2026-11-04"], modelos: [{ nombre: "Modelo 1", caudal: [10, null] }] }
      }]
    }
  });
  assert.equal(r.ok, true);
  assert.equal(r.omitidos.length, 0);
});

test("un aviso sin coordenadas ni descripción se conserva: no se oculta por eso", () => {
  const r = validarProducto("hidro-avisos", {
    contrato: "1.1", producto: "hidro-avisos", emitido: ahora, fuente: "S", datos: {
      avisos: [{
        numero: 1, nivel: "fuerte", tipo: "avenida", emitido: ahora, inicio: ahora, fin: "2026-11-03T10:00:00-05:00", duracion_h: 24,
        titulo: "Aviso", variable: "caudal", valor: null, unidad: "m³/s", estacion: { id: "a", nombre: "A" }
      }]
    }
  });
  assert.equal(r.ok, true);
  assert.equal(r.omitidos.length, 0);
});

test("detalle de estación", () => {
  const d = { contrato: "1.1", producto: "hidro-monitoreo-detalle", id: "a", emitido: ahora, serie: { inicio: ahora, paso_min: 60, caudal: [1, null], nivel: [1, 2] } };
  assert.equal(validarDetalle(d).ok, true);
  assert.equal(validarDetalle({ ...d, serie: { ...d.serie, nivel: [1] } }).ok, false);
  assert.equal(validarDetalle({ ...d, producto: "otro" }).ok, false);
});
