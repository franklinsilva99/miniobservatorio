/* =====================================================================
   Modelo de vista: convierte los productos (contrato) en las estructuras
   que dibujan el mosaico y las vistas ampliadas.
   · Todo texto de origen externo se escapa aquí (una sola vez).
   · Los cálculos de presentación (estado por umbral, promedios de
     modelos, acumulados 24 h) se hacen aquí; las vistas solo dibujan.
   ===================================================================== */
import { proj } from "../geo/peru.js";
import { CONFIG } from "../config.js";
import { NIVELES, ESTADOS, VARIABLES_METEO } from "./contrato.js";
import { repo, detalleDe } from "./repositorio.js";
import { esc, norm, dm, dmhm, dmyhm, fechaLima, fechaLarga, etiquetaDia } from "../ui/util.js";

/** Modelo vigente (se reconstruye cada vez que llega un producto). */
export const M = {};

/** Estado por umbral: 1 normal · 2 moderada · 3 fuerte · 4 extrema · 0 sin datos. */
export const estadoUmbral = (v, u, tipo) => v == null ? 0 : !u ? 1 : tipo === "vaciante"
  ? (v <= u[2] ? 4 : v <= u[1] ? 3 : v <= u[0] ? 2 : 1)
  : (v >= u[2] ? 4 : v >= u[1] ? 3 : v >= u[0] ? 2 : 1);

/**
 * Estado de una estación de monitoreo: el que envía el productor o, si no lo envía, el de sus
 * umbrales. Un dato viejo no dice cómo está hoy el río, salvo que la estación tenga un aviso activo.
 */
function estadoEstacion(e, q, niv, tipo, ahora) {
  const sinUmbralCaudal = q == null || !e.umbrales?.caudal;
  const base = e.estado ? ESTADOS[e.estado]
    : sinUmbralCaudal ? estadoUmbral(niv, e.umbrales?.nivel, tipo) || estadoUmbral(q, null, tipo)
      : estadoUmbral(q, e.umbrales.caudal, tipo);
  const viejo = (q != null || niv != null) && e.actual.fecha != null && ahora - ms(e.actual.fecha) > CONFIG.horas_sin_datos * 3600000;
  return { s: viejo && base <= 1 ? 0 : base, viejo };
}

/** Promedio, mínimo y máximo de los modelos que tienen valor; null si ninguno lo tiene. */
const resumenModelos = d => {
  const v = d.filter(x => x != null);
  return v.length ? { avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), min: Math.min(...v), max: Math.max(...v) } : { avg: null, min: null, max: null };
};

/* Textos genéricos de respaldo cuando el aviso no trae peligro/recomendación propios */
const PELIGRO_H = {
  avenida: { 2: "Indica condiciones normales del río con la posibilidad de incremento en su nivel.", 3: "Indica condiciones del río con tendencia ascendente en su nivel, con posibilidad de alcanzar el umbral de peligro extremo.", 4: "Indica condiciones de peligro por el incremento del nivel o caudal del río, con posible desborde e inundación de zonas ribereñas." },
  vaciante: { 2: "Indica condiciones normales del río con la posibilidad de descenso en su nivel.", 3: "Indica condiciones del río con tendencia descendente en su nivel.", 4: "Indica condiciones donde se esperan limitaciones en el transporte fluvial por el avistamiento de rocas y obstáculos, debido a un mayor descenso en el nivel del río." }
};
const RECOM_H = {
  avenida: { 2: "Seguir reportes de la DZ. Mantenerse informado por la web institucional del SENAMHI.", 3: "Evitar cruce de cauce, alejar bienes de riberas. Mantenerse informado por la web institucional del SENAMHI.", 4: "Evitar cruzar el cauce, alejar bienes de riberas. Seguir indicaciones de la DZ y COEN." },
  vaciante: { 2: "Vigilar el descenso del nivel del río. Mantenerse informado por la web institucional del SENAMHI.", 3: "Precaución por la tendencia descendente del nivel. Mantenerse informado por la web institucional del SENAMHI.", 4: "Restringir la navegación y actividades fluviales por el descenso del nivel. Seguir indicaciones de la DZ y COEN." }
};
export const NIV_M = {
  2: { p: "Pueden ocurrir fenómenos meteorológicos peligrosos que, sin embargo, son normales en esta región.", r: "Manténgase al corriente del desarrollo de la situación meteorológica. Sea prudente si realiza actividades al aire libre que puedan acarrear riesgos en caso de mal tiempo." },
  3: { p: "Se predicen fenómenos meteorológicos peligrosos.", r: "Manténgase al corriente del desarrollo de la situación y cumpla los consejos e instrucciones dados por las autoridades." },
  4: { p: "Se predicen fenómenos meteorológicos de gran magnitud.", r: "Sea extremadamente precavido. Esté al corriente en todo momento del desarrollo de la situación y cumpla los consejos e instrucciones dados por las autoridades." }
};

/** Variables meteorológicas y sus escalas de color (paleta de la guía de UI). */
export const VARS = {
  T: { n: "Temperatura", u: "°C", d: 1, bins: [5, 12, 20, 27], cols: ["#4a6fb5", "#9cc3e4", "#e3eef2", "#f7dc9a", "#f0a98f"], lab: ["<5", "5–12", "12–20", "20–27", ">27"] },
  HR: { n: "Humedad relativa", u: "%", d: 0, bins: [40, 60, 75, 90], cols: ["#f1eef6", "#bdc9e1", "#74a9cf", "#2b8cbe", "#045a8d"], lab: ["<40", "40–60", "60–75", "75–90", ">90"] },
  PP: { n: "Precipitación", u: "mm", d: 1, bins: [.1, 2, 5, 10], cols: ["#f7fcf0", "#bae4bc", "#7bccc4", "#43a2ca", "#0868ac"], lab: ["0", "<2", "2–5", "5–10", ">10"], zero: true, bar: true },
  V: { n: "Viento", u: "km/h", d: 0, bins: [5, 10, 15, 25], cols: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"], lab: ["<5", "5–10", "10–15", "15–25", ">25"] }
};
export const VARK = VARIABLES_METEO;
export const vcol = (k, v) => { if (v == null) return "none"; const b = VARS[k].bins; let i = 0; while (i < b.length && v >= b[i]) i++; return VARS[k].cols[i]; };
const CIELO_E = { despejado: "☀️", nubes_dispersas: "🌤️", nublado_parcial: "⛅", cubierto: "☁️", lluvia_ligera: "🌦️", lluvia_moderada: "🌧️", tormenta: "⛈️", nevada: "🌨️" };

const xy = (lat, lon) => proj(lat, lon);
const ms = iso => Date.parse(iso);
const escL = a => (a || []).map(esc);

/** Promedios diarios (hora de Lima) de una serie horaria; devuelve los últimos n días. */
export function agregarDiario(ser, inicio, paso = 60, n = 3) {
  const g = new Map();
  ser.forEach((v, i) => {
    if (v == null) return;
    const f = fechaLima(ms(inicio) + i * paso * 60000);
    const a = g.get(f) || [0, 0]; a[0] += v; a[1]++; g.set(f, a);
  });
  const dias = [...g.keys()].sort().slice(-n);
  return { v: dias.map(f => +(g.get(f)[0] / g.get(f)[1]).toFixed(2)), l: dias.map(dm) };
}

export function construir(ahora = Date.now()) {
  const D = id => repo.productos[id].json?.datos;
  M.ok = Object.fromEntries(Object.keys(repo.productos).map(id => [id, !!D(id)]));
  M.fuente = Object.fromEntries(Object.keys(repo.productos).map(id => [id, esc(repo.productos[id].json?.fuente || "SENAMHI")]));

  /* ---- hidro-monitoreo ---- */
  M.HST = (D("hidro-monitoreo")?.estaciones || []).map(e => {
    const [x, y] = xy(e.lat, e.lon), q = e.actual.caudal ?? null, niv = e.actual.nivel ?? null;
    const ser = detalleDe("hidro-monitoreo", e.id)?.serie || e.serie;
    return {
      id: esc(e.id), idOrigen: e.id, n: esc(e.nombre), rio: esc(e.rio || "—"), cuenca: esc(e.cuenca || "—"), reg: esc(e.region_hidrografica || "—"),
      dep: esc(e.departamento || "—"), prov: esc(e.provincia || "—"), dist: escL(e.distritos), pob: escL(e.centros_poblados), x, y,
      tipo: e.tipo_umbral, u: e.umbrales?.caudal || null, un: e.umbrales?.nivel || null, q, niv, fecha: e.actual.fecha,
      vars: e.variables || ["caudal", "nivel"], detalle: e.serie ? null : e.detalle || null, conEstado: !!e.estado,
      serQ: ser?.caudal || [], serN: ser?.nivel || [], serIni: ser?.inicio, paso: ser?.paso_min || 60,
      ...estadoEstacion(e, q, niv, e.tipo_umbral, ahora)
    };
  });
  M.HS = id => M.HST.find(s => s.id === id);

  /* ---- hidro-pronostico (autocontenido: no depende de hidro-monitoreo) ---- */
  M.HFC = {};
  (D("hidro-pronostico")?.estaciones || []).forEach(e => {
    const [x, y] = xy(e.lat, e.lon), P = e.pronostico, nD = P.fechas.length;
    const m = Array.from({ length: nD }, (_, d) => P.modelos.map(mo => mo.caudal[d]));
    const res = m.map(resumenModelos), avg = res.map(r => r.avg), conValor = avg.filter(v => v != null);
    const vac = e.tipo_umbral === "vaciante", crit = !conValor.length ? null : vac ? Math.min(...conValor) : Math.max(...conValor);
    const st = { id: esc(e.id), n: esc(e.nombre), rio: esc(e.rio || "—"), dep: esc(e.departamento || "—"), x, y, u: e.umbrales_caudal || null, tipo: e.tipo_umbral };
    M.HFC[st.id] = {
      st, m, modelos: P.modelos.map(x => esc(x.nombre)), obs: e.observado?.caudal || [], fObs: (e.observado?.fechas || []).map(dm), fFc: P.fechas.map(dm),
      avg, min: res.map(r => r.min), max: res.map(r => r.max),
      pico: crit, lblPico: vac ? "mínimo esperado" : "pico esperado", dpico: crit == null ? "—" : dm(P.fechas[avg.indexOf(crit)]), s: estadoUmbral(crit, st.u, st.tipo)
    };
  });

  /* ---- hidro-avisos ---- */
  M.HAV = (D("hidro-avisos")?.avisos || []).map(a => {
    const e = a.estacion, [x, y] = e.lat != null && e.lon != null ? xy(e.lat, e.lon) : [null, null], nv = NIVELES[a.nivel];
    return {
      nro: a.numero, nivel: nv, tipo: a.tipo, plazo: esc(a.plazo || "—"), emitido: a.emitido,
      ini: dmhm(a.inicio), vence: dmhm(a.fin), dur: a.duracion_h,
      vig: a.estado !== "cancelado" && ms(a.fin) >= ahora, cancelado: a.estado === "cancelado",
      var: a.variable, val: a.valor, uni: esc(a.unidad), tend: a.tendencia,
      titulo: esc(a.titulo), desc: esc(a.descripcion || ""),
      peligro: esc(a.peligro || PELIGRO_H[a.tipo][nv]), recom: esc(a.recomendacion || RECOM_H[a.tipo][nv]),
      doc: a.documento || null, serie: a.serie?.valores || null,
      s: { id: esc(e.id), n: esc(e.nombre), rio: esc(e.rio || "—"), dep: esc(e.departamento || "—"), prov: esc(e.provincia || "—"), dist: escL(e.distritos), pob: escL(e.centros_poblados), x, y, u: e.umbrales || null }
    };
  }).sort((a, b) => (b.vig - a.vig) || (a.vig ? b.nivel - a.nivel : 0) || b.nro - a.nro);

  /* ---- meteo-monitoreo ---- */
  M.EST = (D("meteo-monitoreo")?.estaciones || []).map(e => {
    const [x, y] = xy(e.lat, e.lon), ser = {}, now = {}, d24 = {};
    e.variables.forEach(k => {
      now[k] = e.actual[k] ?? null;
      const s = e.serie?.[k]; if (s) ser[k] = s;
      if (!s || s.length < 25) { d24[k] = null; return; }
      d24[k] = k === "PP" ? +s.slice(-24).reduce((a, b) => a + (b || 0), 0).toFixed(1)
        : now[k] != null && s[s.length - 25] != null ? +(now[k] - s[s.length - 25]).toFixed(1) : null;
    });
    return { id: esc(e.id), n: esc(e.nombre), dep: esc(e.departamento), prov: esc(e.provincia), alt: e.altitud, x, y, v: e.variables, now, ser, d24, fecha: e.actual.fecha };
  });
  /** Valor que se muestra para una variable (PP: acumulado de 24 h si existe). */
  M.valor = (e, k) => k === "PP" ? (e.d24.PP ?? e.now.PP) : e.now[k];

  /* ---- meteo-pronostico ---- */
  const PR = D("meteo-pronostico");
  M.FECHAS_PR = PR?.fechas || [];
  M.DIAS3 = M.FECHAS_PR.map(f => etiquetaDia(f, ahora).largo);
  M.DIAS3c = M.FECHAS_PR.map(f => etiquetaDia(f, ahora).corto);
  M.CAPS = (PR?.ciudades || []).map(c => ({ dep: esc(c.departamento), cap: esc(c.ciudad), d: c.dias.map(x => ({ mx: x.tmax, mn: x.tmin, e: CIELO_E[x.cielo], t: esc(x.descripcion) })) }));
  M.CAP = dep => M.CAPS.find(c => norm(c.dep) === norm(dep));
  M.diaHoyPr = Math.max(0, M.FECHAS_PR.indexOf(fechaLima(ahora)));

  /* ---- meteo-avisos ---- */
  M.MAV = (D("meteo-avisos")?.avisos || []).map(a => {
    const nv = NIVELES[a.nivel];
    let dias = (a.dias || []).map(d => ({ fecha: d.fecha, f: fechaLarga(d.fecha), deps: escL(d.departamentos), t: esc(d.texto) }));
    const deps = a.departamentos?.length ? escL(a.departamentos) : [...new Set(dias.flatMap(d => d.deps))];
    if (!dias.length && deps.length) dias = [{ fecha: null, f: "Todo el periodo", deps, t: esc(a.cuerpo || "") }];
    return {
      num: a.numero, cod: esc(a.codigo || String(a.numero)), nivel: nv, titulo: esc(a.titulo),
      emi: dmyhm(a.emitido), ini: dmyhm(a.inicio), fin: dmyhm(a.fin), emiC: dm(a.emitido), iniC: dm(a.inicio), finC: dm(a.fin), dur: a.duracion_h,
      vig: a.estado !== "cancelado" && ms(a.fin) >= ahora, cancelado: a.estado === "cancelado",
      deps, dias, cuerpo: esc(a.cuerpo || ""), peligro: esc(a.peligro || NIV_M[nv].p), recom: esc(a.recomendacion || NIV_M[nv].r), doc: a.documento || null
    };
  }).sort((a, b) => b.num - a.num);
  /** Día del aviso que corresponde a hoy (o el primero). */
  M.diaHoyAv = a => Math.max(0, a.dias.findIndex(d => d.fecha === fechaLima(ahora)));

  M.ahora = ahora;
  return M;
}

/** Nivel máximo de aviso meteorológico vigente por departamento: {departamento normalizado: nivel} */
export function nivelDep() {
  const m = {};
  M.MAV.filter(a => a.vig).forEach(a => a.deps.forEach(d => { const k = norm(d); m[k] = Math.max(m[k] || 0, a.nivel); }));
  return m;
}
