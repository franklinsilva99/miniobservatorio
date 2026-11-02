/* =====================================================================
   Contrato de datos v1.0 del Portal de Contingencia
   ---------------------------------------------------------------------
   Fuente única de verdad del formato que deben publicar los sistemas
   productores. Lo usan:
     · el portal (navegador), para aceptar o rechazar cada archivo, y
     · tools/validar.mjs y tools/publicar.mjs (Node), para que el
       productor verifique su archivo ANTES de publicarlo.
   Documentación legible: docs/contrato-datos.md
   ===================================================================== */

export const VERSION_CONTRATO = "1.0";

/** Los seis productos que muestra el mosaico. */
export const PRODUCTOS = [
  "meteo-monitoreo", "meteo-pronostico", "meteo-avisos",
  "hidro-monitoreo", "hidro-pronostico", "hidro-avisos"
];

/** Niveles de peligro (nomenclatura del Observatorio) → código numérico interno. */
export const NIVELES = { moderada: 2, fuerte: 3, extrema: 4 };
export const VARIABLES_METEO = ["T", "HR", "PP", "V"];
export const CIELOS = ["despejado", "nubes_dispersas", "nublado_parcial", "cubierto", "lluvia_ligera", "lluvia_moderada", "tormenta", "nevada"];

/* ---------- mini lenguaje de esquemas ---------- */
const T = (t, o = {}) => ({ t, ...o });
const str = T("str"), num = T("num"), int = T("int"), iso = T("iso"), fecha = T("fecha");
const opt = s => ({ ...s, opt: true });
const nul = s => ({ ...s, nul: true });
const arr = (of, o = {}) => T("arr", { of, ...o });
const obj = f => T("obj", { f });
const en = (...v) => T("en", { v });

function chk(s, v, p, E) {
  if (E.length >= 25) return;
  if (v === undefined) { if (!s.opt) E.push(`${p}: campo obligatorio ausente`); return; }
  if (v === null) { if (!s.nul) E.push(`${p}: no puede ser null`); return; }
  const bad = m => E.push(`${p}: ${m}`);
  switch (s.t) {
    case "str": if (typeof v !== "string" || !v.trim()) bad("debe ser texto no vacío"); break;
    case "num": if (typeof v !== "number" || !Number.isFinite(v)) bad("debe ser número"); break;
    case "int": if (!Number.isInteger(v)) bad("debe ser entero"); break;
    case "bool": if (typeof v !== "boolean") bad("debe ser true o false"); break;
    case "iso": if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) || isNaN(Date.parse(v))) bad("debe ser fecha-hora ISO 8601 con zona (p. ej. 2026-11-02T10:00:00-05:00)"); break;
    case "fecha": if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) bad("debe ser fecha AAAA-MM-DD"); break;
    case "en": if (!s.v.includes(v)) bad(`valor «${v}» no permitido (use: ${s.v.join(", ")})`); break;
    case "arr":
      if (!Array.isArray(v)) { bad("debe ser lista"); break; }
      if (s.min != null && v.length < s.min) bad(`debe tener al menos ${s.min} elemento(s)`);
      if (s.len != null && v.length !== s.len) bad(`debe tener exactamente ${s.len} elementos`);
      v.forEach((x, i) => chk(s.of, x, `${p}[${i}]`, E));
      break;
    case "obj":
      if (typeof v !== "object" || Array.isArray(v)) { bad("debe ser objeto"); break; }
      for (const k in s.f) chk(s.f[k], v[k], `${p}.${k}`, E);
      break;
  }
}

/* ---------- piezas comunes ---------- */
const nivel = en(...Object.keys(NIVELES));
const coord = { lat: num, lon: num };
const serie = extra => obj({ inicio: iso, paso_min: int, ...extra });
const umbrales3 = arr(num, { len: 3 }); // [moderada, fuerte, extrema]

/* ---------- esquemas por producto (contenido de "datos") ---------- */
const ESQUEMAS = {
  "hidro-monitoreo": obj({
    estaciones: arr(obj({
      id: str, nombre: str, rio: str, cuenca: str, region_hidrografica: opt(str),
      departamento: str, provincia: str, distritos: arr(str), centros_poblados: opt(arr(str)), ...coord,
      tipo_umbral: en("avenida", "vaciante"),
      umbrales: obj({ caudal: umbrales3, nivel: opt(umbrales3) }),
      actual: obj({ fecha: iso, caudal: nul(num), nivel: opt(nul(num)) }),
      serie: opt(serie({ caudal: arr(nul(num)), nivel: opt(arr(nul(num))) }))
    }), { min: 1 })
  }),
  "hidro-pronostico": obj({
    estaciones: arr(obj({
      id: str, nombre: str, rio: str, departamento: str, ...coord,
      tipo_umbral: en("avenida", "vaciante"), umbrales_caudal: umbrales3,
      observado: obj({ fechas: arr(fecha, { min: 1 }), caudal: arr(num, { min: 1 }) }),
      pronostico: obj({ fechas: arr(fecha, { min: 1 }), modelos: arr(obj({ nombre: str, caudal: arr(num) }), { min: 1 }) })
    }), { min: 1 })
  }),
  "hidro-avisos": obj({
    avisos: arr(obj({
      numero: int, nivel, tipo: en("avenida", "vaciante"), plazo: opt(str), estado: opt(en("emitido", "cancelado")),
      emitido: iso, inicio: iso, fin: iso, duracion_h: num,
      titulo: str, descripcion: str, peligro: opt(str), recomendacion: opt(str),
      variable: en("caudal", "nivel"), valor: num, unidad: str, tendencia: opt(en("ascendente", "descendente", "estable")),
      estacion: obj({ id: str, nombre: str, rio: str, departamento: str, provincia: str, distritos: arr(str), centros_poblados: arr(str), ...coord, umbrales: umbrales3 }),
      serie: opt(serie({ valores: arr(nul(num)) })),
      documento: opt(str)
    }))
  }),
  "meteo-monitoreo": obj({
    estaciones: arr(obj({
      id: str, nombre: str, departamento: str, provincia: str, altitud: num, ...coord,
      variables: arr(en(...VARIABLES_METEO), { min: 1 }),
      actual: obj({ fecha: iso, T: opt(nul(num)), HR: opt(nul(num)), PP: opt(nul(num)), V: opt(nul(num)) }),
      serie: opt(serie({ T: opt(arr(nul(num))), HR: opt(arr(nul(num))), PP: opt(arr(nul(num))), V: opt(arr(nul(num))) }))
    }), { min: 1 })
  }),
  "meteo-pronostico": obj({
    fechas: arr(fecha, { min: 1 }),
    ciudades: arr(obj({
      departamento: str, ciudad: str,
      dias: arr(obj({ tmax: num, tmin: num, cielo: en(...CIELOS), descripcion: str }), { min: 1 })
    }), { min: 1 })
  }),
  "meteo-avisos": obj({
    avisos: arr(obj({
      numero: int, codigo: opt(str), nivel, estado: opt(en("emitido", "cancelado")),
      titulo: str, emitido: iso, inicio: iso, fin: iso, duracion_h: num,
      departamentos: opt(arr(str)), cuerpo: opt(str), peligro: opt(str), recomendacion: opt(str),
      dias: opt(arr(obj({ fecha, departamentos: arr(str), texto: str }))),
      documento: opt(str)
    }))
  })
};

/* ---------- reglas que cruzan campos ---------- */
const REGLAS = {
  "hidro-monitoreo": (d, E) => d.estaciones.forEach((s, i) => {
    const p = `datos.estaciones[${i}]`;
    if (s.serie) {
      if (s.serie.nivel && s.serie.nivel.length !== s.serie.caudal.length) E.push(`${p}.serie: «nivel» y «caudal» deben tener la misma longitud`);
    }
    if (s.tipo_umbral === "avenida" && !(s.umbrales.caudal[0] < s.umbrales.caudal[1] && s.umbrales.caudal[1] < s.umbrales.caudal[2])) E.push(`${p}.umbrales.caudal: en avenida deben ser crecientes (moderada < fuerte < extrema)`);
    if (s.tipo_umbral === "vaciante" && !(s.umbrales.caudal[0] > s.umbrales.caudal[1] && s.umbrales.caudal[1] > s.umbrales.caudal[2])) E.push(`${p}.umbrales.caudal: en vaciante deben ser decrecientes (moderada > fuerte > extrema)`);
  }),
  "hidro-pronostico": (d, E) => d.estaciones.forEach((s, i) => {
    const p = `datos.estaciones[${i}]`, n = s.pronostico.fechas.length;
    if (s.observado.fechas.length !== s.observado.caudal.length) E.push(`${p}.observado: «fechas» y «caudal» deben tener la misma longitud`);
    s.pronostico.modelos.forEach((m, j) => { if (m.caudal.length !== n) E.push(`${p}.pronostico.modelos[${j}].caudal: debe tener ${n} valores (uno por fecha)`); });
  }),
  "hidro-avisos": (d, E) => d.avisos.forEach((a, i) => { if (Date.parse(a.fin) < Date.parse(a.inicio)) E.push(`datos.avisos[${i}]: «fin» es anterior a «inicio»`); }),
  "meteo-monitoreo": (d, E) => d.estaciones.forEach((s, i) => {
    s.variables.forEach(v => { if (!(v in s.actual)) E.push(`datos.estaciones[${i}].actual.${v}: la estación declara la variable pero no envía su valor (use null si no hay dato)`); });
  }),
  "meteo-pronostico": (d, E) => d.ciudades.forEach((c, i) => { if (c.dias.length !== d.fechas.length) E.push(`datos.ciudades[${i}].dias: debe tener ${d.fechas.length} días (uno por cada fecha de «fechas»)`); }),
  "meteo-avisos": (d, E) => d.avisos.forEach((a, i) => { if (Date.parse(a.fin) < Date.parse(a.inicio)) E.push(`datos.avisos[${i}]: «fin» es anterior a «inicio»`); })
};

/**
 * Valida un archivo de producto completo (sobre + datos).
 * @returns {{ok:boolean, errores:string[]}}
 */
export function validarProducto(id, json) {
  const E = [];
  if (!PRODUCTOS.includes(id)) return { ok: false, errores: [`producto desconocido: ${id}`] };
  chk(obj({ contrato: str, producto: str, emitido: iso, fuente: str, datos: T("obj", { f: {} }) }), json, "archivo", E);
  if (E.length) return { ok: false, errores: E };
  if (json.producto !== id) E.push(`archivo.producto: se esperaba «${id}» y llegó «${json.producto}»`);
  if (String(json.contrato).split(".")[0] !== VERSION_CONTRATO.split(".")[0]) E.push(`archivo.contrato: versión ${json.contrato} incompatible (el portal admite ${VERSION_CONTRATO.split(".")[0]}.x)`);
  chk(ESQUEMAS[id], json.datos, "datos", E);
  if (!E.length) REGLAS[id]?.(json.datos, E);
  return { ok: E.length === 0, errores: E };
}

/** Valida el manifiesto que lista los productos publicados. */
export function validarManifiesto(json) {
  const E = [];
  chk(obj({
    contrato: str, generado: iso, demo: opt(T("bool")),
    productos: arr(obj({ id: en(...PRODUCTOS), url: str, emitido: iso, frecuencia_min: int }), { min: 1 })
  }), json, "manifest", E);
  if (!E.length) {
    const vistos = new Set();
    json.productos.forEach((p, i) => { if (vistos.has(p.id)) E.push(`manifest.productos[${i}]: «${p.id}» está repetido`); vistos.add(p.id); });
  }
  return { ok: E.length === 0, errores: E };
}
