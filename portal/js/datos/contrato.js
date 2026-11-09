/* =====================================================================
   Contrato de datos v1.1 del Portal de Contingencia
   ---------------------------------------------------------------------
   Fuente única de verdad del formato que deben publicar los sistemas
   productores. Lo usan:
     · el portal (navegador), para aceptar o rechazar cada archivo, y
     · tools/validar.mjs y tools/publicar.mjs (Node), para que el
       productor verifique su archivo ANTES de publicarlo.
   Documentación legible: docs/contrato-datos.md

   La validación tiene dos niveles: un error del archivo lo rechaza
   completo; un error de un elemento (estación, ciudad o aviso) omite solo
   ese elemento, salvo que sean demasiados (LIMITE_OMISION).
   ===================================================================== */

export const VERSION_CONTRATO = "1.1";

/** Los seis productos que muestra el mosaico. */
export const PRODUCTOS = [
  "meteo-monitoreo", "meteo-pronostico", "meteo-avisos",
  "hidro-monitoreo", "hidro-pronostico", "hidro-avisos"
];

/** Niveles de peligro (nomenclatura del Observatorio) → código numérico interno. */
export const NIVELES = { moderada: 2, fuerte: 3, extrema: 4 };
/** Estado de una estación que puede enviar el productor → código numérico interno. */
export const ESTADOS = { sin_datos: 0, normal: 1, moderada: 2, fuerte: 3, extrema: 4 };
export const VARIABLES_METEO = ["T", "HR", "PP", "V"];
export const CIELOS = ["despejado", "nubes_dispersas", "nublado_parcial", "cubierto", "lluvia_ligera", "lluvia_moderada", "tormenta", "nevada"];

/** Si se omite más de esta fracción de elementos, se sospecha un error general y se rechaza el archivo. */
export const LIMITE_OMISION = 0.2;

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
const valores = arr(nul(num));
const umbrales3 = arr(num, { len: 3 }); // [moderada, fuerte, extrema]
/* Ubicación: se publica lo que tenga el catálogo; su falta no impide mostrar la estación. */
const zona = { rio: opt(str), departamento: opt(str), provincia: opt(str), distritos: opt(arr(str)), centros_poblados: opt(arr(str)) };

/* ---------- producto = campos propios + una lista de elementos independientes ---------- */
const PRODUCTO = {
  "hidro-monitoreo": {
    lista: "estaciones", minimo: 1,
    elemento: obj({
      id: str, nombre: str, cuenca: opt(str), region_hidrografica: opt(str), ...zona, ...coord,
      tipo_umbral: en("avenida", "vaciante"),
      variables: opt(arr(en("caudal", "nivel"), { min: 1 })),
      estado: opt(en(...Object.keys(ESTADOS))),
      umbrales: opt(obj({ caudal: opt(umbrales3), nivel: opt(umbrales3) })),
      actual: obj({ fecha: nul(iso), caudal: opt(nul(num)), nivel: opt(nul(num)) }),
      serie: opt(serie({ caudal: opt(valores), nivel: opt(valores) })),
      detalle: opt(str)
    })
  },
  "hidro-pronostico": {
    lista: "estaciones", minimo: 1,
    elemento: obj({
      id: str, nombre: str, rio: opt(str), departamento: opt(str), ...coord,
      tipo_umbral: en("avenida", "vaciante"), umbrales_caudal: opt(umbrales3),
      observado: opt(obj({ fechas: arr(fecha), caudal: valores })),
      pronostico: obj({ fechas: arr(fecha, { min: 1 }), modelos: arr(obj({ nombre: str, caudal: valores }), { min: 1 }) })
    })
  },
  "hidro-avisos": {
    lista: "avisos", minimo: 0,
    elemento: obj({
      numero: int, nivel, tipo: en("avenida", "vaciante"), plazo: opt(str), estado: opt(en("emitido", "cancelado")),
      emitido: iso, inicio: iso, fin: iso, duracion_h: num,
      titulo: str, descripcion: opt(str), peligro: opt(str), recomendacion: opt(str),
      variable: en("caudal", "nivel"), valor: nul(num), unidad: str, tendencia: opt(en("ascendente", "descendente", "estable")),
      /* Sin coordenadas el aviso se muestra igual: ocultar un aviso es peor que no ubicarlo en el mapa. */
      estacion: obj({ id: str, nombre: str, ...zona, lat: opt(num), lon: opt(num), umbrales: opt(umbrales3) }),
      serie: opt(serie({ valores })),
      documento: opt(str)
    })
  },
  "meteo-monitoreo": {
    lista: "estaciones", minimo: 1,
    elemento: obj({
      id: str, nombre: str, departamento: str, provincia: str, altitud: num, ...coord,
      variables: arr(en(...VARIABLES_METEO), { min: 1 }),
      actual: obj({ fecha: iso, T: opt(nul(num)), HR: opt(nul(num)), PP: opt(nul(num)), V: opt(nul(num)) }),
      serie: opt(serie({ T: opt(valores), HR: opt(valores), PP: opt(valores), V: opt(valores) }))
    })
  },
  "meteo-pronostico": {
    lista: "ciudades", minimo: 1,
    resto: { fechas: arr(fecha, { min: 1 }) },
    elemento: obj({
      departamento: str, ciudad: str,
      dias: arr(obj({ tmax: num, tmin: num, cielo: en(...CIELOS), descripcion: str }), { min: 1 })
    })
  },
  "meteo-avisos": {
    lista: "avisos", minimo: 0,
    elemento: obj({
      numero: int, codigo: opt(str), nivel, estado: opt(en("emitido", "cancelado")),
      titulo: str, emitido: iso, inicio: iso, fin: iso, duracion_h: num,
      departamentos: opt(arr(str)), cuerpo: opt(str), peligro: opt(str), recomendacion: opt(str),
      dias: opt(arr(obj({ fecha, departamentos: arr(str), texto: str }))),
      documento: opt(str)
    })
  }
};

/* ---------- reglas que cruzan campos de un mismo elemento ---------- */
function ordenUmbrales(u, tipo, p, E) {
  if (!u) return;
  if (tipo === "avenida" && !(u[0] < u[1] && u[1] < u[2])) E.push(`${p}: en avenida deben ser crecientes (moderada < fuerte < extrema)`);
  if (tipo === "vaciante" && !(u[0] > u[1] && u[1] > u[2])) E.push(`${p}: en vaciante deben ser decrecientes (moderada > fuerte > extrema)`);
}
const finTrasInicio = (a, p, E) => { if (Date.parse(a.fin) < Date.parse(a.inicio)) E.push(`${p}: «fin» es anterior a «inicio»`); };

const REGLAS = {
  "hidro-monitoreo": (s, p, E) => {
    if (s.serie?.nivel && s.serie?.caudal && s.serie.nivel.length !== s.serie.caudal.length) E.push(`${p}.serie: «nivel» y «caudal» deben tener la misma longitud`);
    ordenUmbrales(s.umbrales?.caudal, s.tipo_umbral, `${p}.umbrales.caudal`, E);
    ordenUmbrales(s.umbrales?.nivel, s.tipo_umbral, `${p}.umbrales.nivel`, E);
    if (s.detalle != null && !rutaRelativa(s.detalle)) E.push(`${p}.detalle: debe ser una ruta relativa a un archivo .json`);
  },
  "hidro-pronostico": (s, p, E) => {
    const n = s.pronostico.fechas.length;
    if (s.observado && s.observado.fechas.length !== s.observado.caudal.length) E.push(`${p}.observado: «fechas» y «caudal» deben tener la misma longitud`);
    s.pronostico.modelos.forEach((m, j) => { if (m.caudal.length !== n) E.push(`${p}.pronostico.modelos[${j}].caudal: debe tener ${n} valores (uno por fecha; null si falta)`); });
    ordenUmbrales(s.umbrales_caudal, s.tipo_umbral, `${p}.umbrales_caudal`, E);
  },
  "hidro-avisos": (a, p, E) => {
    finTrasInicio(a, p, E);
    ordenUmbrales(a.estacion.umbrales, a.tipo, `${p}.estacion.umbrales`, E);
  },
  "meteo-monitoreo": (s, p, E) => {
    s.variables.forEach(v => { if (!(v in s.actual)) E.push(`${p}.actual.${v}: la estación declara la variable pero no envía su valor (use null si no hay dato)`); });
  },
  "meteo-pronostico": (c, p, E, datos) => {
    if (c.dias.length !== datos.fechas.length) E.push(`${p}.dias: debe tener ${datos.fechas.length} días (uno por cada fecha de «fechas»)`);
  },
  "meteo-avisos": finTrasInicio
};

/** Ruta relativa dentro del repositorio: sin protocolo ni «..». */
const rutaRelativa = r => /^[\w./-]+\.json$/.test(r) && !r.startsWith("/") && !r.split("/").includes("..");

/** Cuántos elementos se pueden omitir: uno siempre, para que una lista corta no caiga por un solo error. */
const omisionesPermitidas = total => Math.max(1, Math.floor(total * LIMITE_OMISION));

/**
 * Valida un archivo de producto completo y separa los elementos inválidos.
 * @returns {{ok:boolean, errores:string[], json:object|null, omitidos:{indice:number,id:*,errores:string[]}[], total:number}}
 *   ok: el archivo se puede mostrar. json: el archivo sin los elementos omitidos.
 *   errores: el motivo del rechazo o, si ok, el detalle de lo omitido.
 */
export function validarProducto(id, json) {
  const rechazo = (errores, omitidos = [], total = 0) => ({ ok: false, errores, json: null, omitidos, total });
  if (!PRODUCTOS.includes(id)) return rechazo([`producto desconocido: ${id}`]);
  const E = [];
  chk(obj({ contrato: str, producto: str, emitido: iso, fuente: str, omitidos: opt(int), datos: T("obj", { f: {} }) }), json, "archivo", E);
  if (E.length) return rechazo(E);
  if (json.producto !== id) E.push(`archivo.producto: se esperaba «${id}» y llegó «${json.producto}»`);
  if (String(json.contrato).split(".")[0] !== VERSION_CONTRATO.split(".")[0]) E.push(`archivo.contrato: versión ${json.contrato} incompatible (el portal admite ${VERSION_CONTRATO.split(".")[0]}.x)`);

  const def = PRODUCTO[id], lista = json.datos[def.lista];
  chk(obj(def.resto || {}), json.datos, "datos", E);
  if (!Array.isArray(lista)) E.push(`datos.${def.lista}: debe ser lista`);
  if (E.length) return rechazo(E);

  const validos = [], omitidos = [];
  lista.forEach((el, indice) => {
    const p = `datos.${def.lista}[${indice}]`, errores = [];
    chk(def.elemento, el, p, errores);
    if (!errores.length) REGLAS[id]?.(el, p, errores, json.datos);
    if (errores.length) omitidos.push({ indice, id: el?.id ?? el?.numero ?? el?.ciudad ?? null, errores });
    else validos.push(el);
  });

  const detalle = omitidos.flatMap(o => o.errores);
  if (omitidos.length > omisionesPermitidas(lista.length)) {
    return rechazo([`${omitidos.length} de ${lista.length} elementos tienen errores: se rechaza el archivo completo`, ...detalle.slice(0, 25)], omitidos, lista.length);
  }
  if (validos.length < def.minimo) {
    return rechazo([`datos.${def.lista}: debe tener al menos ${def.minimo} elemento(s) válido(s)`, ...detalle.slice(0, 25)], omitidos, lista.length);
  }
  return {
    ok: true, errores: detalle, omitidos, total: lista.length,
    json: omitidos.length ? { ...json, datos: { ...json.datos, [def.lista]: validos } } : json
  };
}

/** Valida el archivo de detalle de una estación (la serie que se descarga al abrirla). */
export function validarDetalle(json) {
  const E = [];
  chk(obj({
    contrato: str, producto: en("hidro-monitoreo-detalle"), id: str, emitido: iso,
    serie: serie({ caudal: opt(valores), nivel: opt(valores) })
  }), json, "detalle", E);
  if (!E.length && json.serie.nivel && json.serie.caudal && json.serie.nivel.length !== json.serie.caudal.length) E.push("detalle.serie: «nivel» y «caudal» deben tener la misma longitud");
  return { ok: E.length === 0, errores: E };
}

/** Valida un manifiesto. Cada sistema productor puede tener el suyo con sus productos. */
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
