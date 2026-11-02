#!/usr/bin/env node
/* =====================================================================
   Genera un repositorio de DEMOSTRACIÓN con los seis productos, fechados
   a la hora actual, usando los datos de las PoC (senamhi-hidrologia y
   senamhi-pronostico-dashboard). Simula a los sistemas productores:
   publica cada archivo con lib-publicacion.mjs, igual que lo harían ellos.

   Uso:  node tools/generar-ejemplos.mjs [--fecha 2026-11-02T10:00] [--repo productos] [--continuo]
   Ejecutarlo antes de cada demostración para que los productos estén «al día».
   --continuo: vuelve a publicar cada 10 min (como los sistemas reales), para
   demostraciones largas; detener con Ctrl+C.
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicar, FRECUENCIA } from "./lib-publicacion.mjs";
import { VERSION_CONTRATO } from "../js/datos/contrato.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const repo = path.resolve(arg("--repo") || path.join(raiz, "productos"));

/* ---------- tiempo (Perú: UTC−5, sin horario de verano) ---------- */
const H = 3600000, DIA = 24 * H, OFF = -5 * H;
const fArg = arg("--fecha");
const M10 = 10 * 60000;
const B = fArg ? Date.parse(fArg.length <= 16 ? fArg + ":00-05:00" : fArg) : Math.floor(Date.now() / M10) * M10; // última emisión de 10 min
if (isNaN(B)) { console.error("Fecha inválida: use --fecha AAAA-MM-DDTHH:MM"); process.exit(2); }
const iso = t => new Date(t + OFF).toISOString().slice(0, 19) + "-05:00";
const fecha = t => new Date(t + OFF).toISOString().slice(0, 10);
const medianoche = t => Math.floor((t + OFF) / DIA) * DIA - OFF; // 00:00 de Lima de ese día
const SEM = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const dl = t => { const d = new Date(t + OFF); return { sem: SEM[d.getUTCDay()], dia: d.getUTCDate(), mes: MES[d.getUTCMonth()] }; };
const cap = s => s[0].toUpperCase() + s.slice(1);
const largo = t => { const x = dl(t); return `${cap(x.sem)} ${x.dia} de ${x.mes}`; };
const rango = (a, b) => { const x = dl(a), y = dl(b); return x.mes === y.mes ? `del ${x.sem} ${x.dia} al ${y.sem} ${y.dia} de ${y.mes}` : `del ${x.sem} ${x.dia} de ${x.mes} al ${y.sem} ${y.dia} de ${y.mes}`; };
const HOY = medianoche(B);

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const r1 = v => +v.toFixed(1), r2 = v => +v.toFixed(2);
const sobre = (producto, emitido, fuente, datos) => ({ contrato: VERSION_CONTRATO, producto, emitido: iso(emitido), fuente, datos });

/* =================== HIDROLOGÍA (PoC senamhi-hidrologia: stations.json, umbrales.json, forecast_inputs.json, alerts.json) =================== */
const HST = [
  { id: "socsi", n: "Socsi", rio: "Cañete", cuenca: "Cañete", reg: "Pacífico", dep: "Lima", prov: "Cañete", dist: ["Nuevo Imperial", "Cañete"], pob: ["Cañete", "Nuevo Imperial"], lat: -13.03051, lon: -76.20027, tipo: "avenida", u: [42, 54, 69], q: 58.4, niv: 3.21, un: [1.95, 3.06, 4.42] },
  { id: "chosica", n: "Chosica", rio: "Rímac", cuenca: "Rímac", reg: "Pacífico", dep: "Lima", prov: "Lima", dist: ["Lurigancho-Chosica"], pob: ["Chosica", "Lurigancho-Chosica"], lat: -11.92986, lon: -76.68964, tipo: "avenida", u: [49, 60, 72], q: 52.0, niv: 2.14, un: [2.05, 2.40, 2.80] },
  { id: "pisac", n: "Pisac", rio: "Vilcanota", cuenca: "Vilcanota", reg: "Amazonas", dep: "Cusco", prov: "Calca", dist: ["Pisac", "Lamay"], pob: ["Pisac", "Coya"], lat: -13.4195, lon: -71.8509, tipo: "avenida", u: [170, 205, 245], q: 182.5, niv: 2.86, un: [2.70, 3.10, 3.55] },
  { id: "puente-ramis", n: "Puente Ramis", rio: "Ramis", cuenca: "Ramis", reg: "Titicaca", dep: "Puno", prov: "Azángaro", dist: ["Arapa", "Taraco"], pob: ["Arapa", "Taraco"], lat: -15.255309, lon: -69.873786, tipo: "vaciante", u: [22, 18, 15], q: 16.3, niv: 0.92, un: [1.10, 0.98, 0.85] },
  { id: "el-tigre", n: "El Tigre", rio: "Tumbes", cuenca: "Tumbes", reg: "Pacífico", dep: "Tumbes", prov: "Tumbes", dist: ["San Jacinto"], pob: ["San Jacinto"], lat: -3.7688, lon: -80.4568, tipo: "avenida", u: [170, 190, 215], q: 96.0, niv: 1.62, un: [2.60, 2.95, 3.30] },
  { id: "cirato", n: "Cirato", rio: "Chancay-Lambayeque", cuenca: "Chancay-Lambayeque", reg: "Pacífico", dep: "Cajamarca", prov: "Santa Cruz", dist: ["Catache"], pob: ["Catache"], lat: -6.65583, lon: -79.07384, tipo: "avenida", u: [165, 185, 210], q: null, niv: null, un: [2.4, 2.8, 3.2] },
  { id: "santo-domingo", n: "Santo Domingo", rio: "Chancay-Huaral", cuenca: "Chancay-Huaral", reg: "Pacífico", dep: "Lima", prov: "Huaral", dist: ["Huaral"], pob: ["Huaral"], lat: -11.3836, lon: -77.0503, tipo: "avenida", u: [70, 82, 95], q: 38.0, niv: 1.05, un: [1.80, 2.10, 2.45] }
];
HST.forEach((s, i) => {
  const r = rng(31 + i * 7), asc = s.tipo === "avenida";
  s.serQ = s.q == null ? [] : Array.from({ length: 72 }, (_, h) => { const f = h / 71; return r1(s.q * (asc ? .72 + .28 * f : 1.22 - .22 * f) + Math.sin(h / 4) * s.q * .025 + (r() - .5) * s.q * .03); });
  if (s.serQ.length) s.serQ[71] = s.q;
  s.serN = s.serQ.map(v => r2(v * s.niv / s.q));
});
const HS = id => HST.find(s => s.id === id);

const hidroMonitoreo = sobre("hidro-monitoreo", B, "SENAMHI · Dirección de Hidrología (red de estaciones hidrológicas)", {
  estaciones: HST.map(s => ({
    id: s.id, nombre: s.n, rio: s.rio, cuenca: s.cuenca, region_hidrografica: s.reg, departamento: s.dep, provincia: s.prov,
    distritos: s.dist, centros_poblados: s.pob, lat: s.lat, lon: s.lon, tipo_umbral: s.tipo,
    umbrales: { caudal: s.u, nivel: s.un },
    actual: { fecha: iso(B), caudal: s.q, nivel: s.niv },
    ...(s.serQ.length ? { serie: { inicio: iso(B - 71 * H), paso_min: 60, caudal: s.serQ, nivel: s.serN } } : {})
  }))
});

const HFC = {
  "socsi": { m: [[55.4, 56.7, 58.0], [53.2, 54.5, 55.8], [50.1, 51.6, 53.0]], obs: [44.1, 46.8, 49.5, 52.2, 55.0, 57.6] },
  "chosica": { m: [[53.0, 54.6, 55.9], [55.2, 57.1, 58.4], [54.0, 55.8, 57.5]], obs: [41.2, 43.0, 45.6, 48.1, 50.2, 51.6] },
  "pisac": { m: [[186, 190, 193, 197], [192, 198, 203, 209], [188, 195, 201, 206]], obs: [150, 158, 165, 171, 177, 181] },
  "el-tigre": { m: [[98, 101, 104], [101, 106, 110], [99, 104, 108]], obs: [88, 90, 92, 93, 95, 96] }
};
const hidroPronostico = sobre("hidro-pronostico", HOY + 7 * H, "SENAMHI · Dirección de Hidrología (modelos de pronóstico hidrológico)", {
  estaciones: Object.entries(HFC).map(([id, f]) => {
    const s = HS(id), nM = f.m[0].length;
    return {
      id, nombre: s.n, rio: s.rio, departamento: s.dep, lat: s.lat, lon: s.lon, tipo_umbral: s.tipo, umbrales_caudal: s.u,
      observado: { fechas: f.obs.map((_, i) => fecha(HOY - (f.obs.length - 1 - i) * DIA)), caudal: f.obs },
      pronostico: { fechas: f.m.map((_, i) => fecha(HOY + (i + 1) * DIA)), modelos: Array.from({ length: nM }, (_, k) => ({ nombre: `Modelo ${k + 1}`, caudal: f.m.map(d => d[k]) })) }
    };
  })
});

const PELIGRO_H = { avenida: { 2: "Indica condiciones normales del río con la posibilidad de incremento en su nivel.", 3: "Indica condiciones del río con tendencia ascendente en su nivel, con posibilidad de alcanzar el umbral de peligro extremo." }, vaciante: { 3: "Indica condiciones del río con tendencia descendente en su nivel." } };
const RECOM_H = { avenida: { 2: "Seguir reportes de la DZ. Mantenerse informado por la web institucional del SENAMHI.", 3: "Evitar cruce de cauce, alejar bienes de riberas. Mantenerse informado por la web institucional del SENAMHI." }, vaciante: { 3: "Precaución por la tendencia descendente del nivel. Mantenerse informado por la web institucional del SENAMHI." } };
const NV = { 2: "moderada", 3: "fuerte", 4: "extrema" };
const HAV = [
  { nro: 1613, st: "socsi", nivel: 3, plazo: "Extendido", ini: B - H, dur: 150, val: 58.40, tend: "ascendente" },
  { nro: 1616, st: "puente-ramis", nivel: 3, plazo: "Normal", ini: B - H, dur: 24, val: 16.30, tend: "descendente" },
  { nro: 1614, st: "chosica", nivel: 2, plazo: "Extendido", ini: B - H, dur: 200, val: 52.00, tend: "ascendente" },
  { nro: 1615, st: "pisac", nivel: 2, plazo: "Extendido", ini: B - H, dur: 200, val: 182.50, tend: "ascendente" },
  { nro: 1612, st: "el-tigre", nivel: 2, plazo: "Normal", ini: HOY - 6 * DIA + 8 * H, dur: 24, val: 172.0, tend: "descendente", viejo: true },
  { nro: 1611, st: "santo-domingo", nivel: 2, plazo: "Normal", ini: HOY - 8 * DIA + 8 * H, dur: 24, val: 71.3, tend: "descendente", viejo: true }
];
const hidroAvisos = sobre("hidro-avisos", B - H, "SENAMHI · Dirección de Hidrología (avisos hidrológicos)", {
  avisos: HAV.map(a => {
    const s = HS(a.st), L = NV[a.nivel].toUpperCase(), tipo = s.tipo;
    return {
      numero: a.nro, nivel: NV[a.nivel], tipo, plazo: a.plazo, estado: "emitido",
      emitido: iso(a.ini), inicio: iso(a.ini), fin: iso(a.ini + a.dur * H), duracion_h: a.dur,
      titulo: `SITUACIÓN ACTUAL DEL CAUDAL DEL RÍO ${s.rio.toUpperCase()} - ESTACIÓN ${s.n.toUpperCase()}`,
      descripcion: `El SENAMHI, organismo adscrito al Ministerio del Ambiente, informa sobre el comportamiento hidrológico del RÍO ${s.rio.toUpperCase()}. La estación hidrológica ${s.n.toUpperCase()} registró un CAUDAL de ${a.val.toFixed(2).replace(".", ",")} m³/s, con tendencia ${a.tend}, ubicándose en el umbral ${L}. Las potenciales áreas de afectación serían los centros poblados de ${s.pob.join(", ").toUpperCase()}. Se recomienda a la población tomar las precauciones correspondientes${tipo === "avenida" ? " y evitar realizar cualquier actividad cercana al río" : ""}. El SENAMHI continuará vigilando el comportamiento del río e informará oportunamente.`,
      peligro: PELIGRO_H[tipo][a.nivel], recomendacion: RECOM_H[tipo][a.nivel],
      variable: "caudal", valor: a.val, unidad: "m³/s", tendencia: a.tend,
      estacion: { id: s.id, nombre: s.n, rio: s.rio, departamento: s.dep, provincia: s.prov, distritos: s.dist, centros_poblados: s.pob, lat: s.lat, lon: s.lon, umbrales: s.u },
      ...(!a.viejo && s.serQ.length ? { serie: { inicio: iso(B - 65 * H), paso_min: 60, valores: s.serQ.slice(6) } } : {})
    };
  })
});

/* =================== METEOROLOGÍA (PoC senamhi-pronostico-dashboard: estaciones.json, seed.ts) =================== */
const EST = JSON.parse(fs.readFileSync(path.join(raiz, "tools", "semilla", "estaciones-meteo.json"), "utf8"));
const PX = lon => (lon + 81.4) * 0.986286 * 23.6; // misma proyección que js/geo/peru.js (solo para clasificar selva/costa)
const meteoMonitoreo = sobre("meteo-monitoreo", B, "SENAMHI · Dirección de Redes de Observación (estaciones automáticas)", {
  estaciones: EST.map((e, i) => {
    const r = rng(101 + i * 13), selva = e.altitud < 1000 && PX(e.lon) > 110, costa = e.altitud < 600 && !selva;
    const T = 29 - .0062 * e.altitud + (selva ? 2 : 0) + (costa ? -4 : 0) + (r() - .5) * 3;
    const HR = costa ? 82 + r() * 10 : selva ? 78 + r() * 15 : 50 + r() * 25;
    const PP = selva ? (r() > .35 ? r() * 16 : 0) : e.altitud > 3000 ? (r() > .6 ? r() * 6 : 0) : (r() > .85 ? r() * 2 : 0);
    const V = costa ? 12 + r() * 14 : 5 + r() * 14;
    const now = { T: r1(T), HR: Math.round(HR), PP: r1(PP), V: Math.round(V) }, rr = rng(500 + i), ser = {};
    ser.T = Array.from({ length: 72 }, (_, h) => r1(T - 5 * Math.cos((h + 4) / 24 * 2 * Math.PI) * (e.altitud > 3000 ? 1.6 : 1) + (rr() - .5)));
    ser.HR = ser.T.map(t => Math.max(15, Math.min(100, Math.round(HR + (T - t) * 3 + (rr() - .5) * 4))));
    ser.PP = Array.from({ length: 72 }, (_, h) => h > 58 && PP > 0 ? r1(PP / 13 * rr() * 2) : (rr() > .93 && PP > 0 ? r1(rr() * 2) : 0));
    ser.V = Array.from({ length: 72 }, (_, h) => Math.max(0, Math.round(V + 6 * Math.sin((h - 9) / 24 * 2 * Math.PI) + (rr() - .5) * 4)));
    for (const k in ser) ser[k][71] = now[k];
    // Ejemplo de falla de sensor: la estación declara viento pero no lo transmitió en esta hora
    if (e.nombre === "Ema Imata") { now.V = null; ser.V[71] = null; }
    const actual = { fecha: iso(B) }, serie = { inicio: iso(B - 71 * H), paso_min: 60 };
    e.variables.forEach(k => { actual[k] = now[k]; serie[k] = ser[k]; });
    return { ...e, actual, serie };
  })
});

const CIELO = [["despejado", "Cielo despejado."], ["nubes_dispersas", "Cielo con nubes dispersas variando a cielo despejado por la tarde."], ["nublado_parcial", "Cielo nublado parcial con brillo solar hacia el mediodía."], ["cubierto", "Cielo cubierto variando a nublado parcial."], ["lluvia_ligera", "Cielo nublado parcial con lluvia ligera por la tarde."], ["lluvia_moderada", "Cielo cubierto con lluvia moderada por la tarde."], ["tormenta", "Chubascos con descargas eléctricas por la tarde."], ["nevada", "Cielo nublado con nevada ligera en zonas altas por la noche."]];
const CAPS = [["Amazonas", "Chachapoyas", 23, 12, [4, 2, 4]], ["Áncash", "Huaraz", 23, 7, [2, 4, 2]], ["Apurímac", "Abancay", 26, 11, [2, 2, 4]], ["Arequipa", "Arequipa", 25, 9, [0, 1, 0]], ["Ayacucho", "Ayacucho", 25, 9, [1, 2, 4]], ["Cajamarca", "Cajamarca", 22, 8, [4, 5, 4]], ["Callao", "Callao", 20, 16, [3, 2, 2]], ["Cusco", "Cusco", 22, 4, [2, 6, 4]], ["Huancavelica", "Huancavelica", 17, 1, [4, 7, 4]], ["Huánuco", "Huánuco", 28, 14, [1, 2, 4]], ["Ica", "Ica", 30, 15, [0, 0, 1]], ["Junín", "Huancayo", 21, 3, [2, 4, 6]], ["La Libertad", "Trujillo", 24, 17, [2, 1, 1]], ["Lambayeque", "Chiclayo", 28, 18, [1, 1, 2]], ["Lima", "Lima", 21, 16, [3, 2, 2]], ["Loreto", "Iquitos", 33, 23, [6, 5, 4]], ["Madre de Dios", "Puerto Maldonado", 34, 22, [2, 6, 5]], ["Moquegua", "Moquegua", 28, 12, [0, 0, 1]], ["Pasco", "Cerro de Pasco", 12, -3, [4, 7, 7]], ["Piura", "Piura", 33, 21, [1, 0, 1]], ["Puno", "Puno", 15, -4, [2, 4, 7]], ["San Martín", "Moyobamba", 30, 18, [5, 6, 4]], ["Tacna", "Tacna", 26, 12, [0, 1, 0]], ["Tumbes", "Tumbes", 32, 23, [1, 2, 1]], ["Ucayali", "Pucallpa", 34, 22, [2, 6, 5]]];
const meteoPronostico = sobre("meteo-pronostico", HOY + 5 * H, "SENAMHI · Dirección de Meteorología (pronóstico por ciudades)", {
  fechas: [0, 1, 2].map(k => fecha(HOY + k * DIA)),
  ciudades: CAPS.map(([dep, cap, mx, mn, ic], i) => {
    const r = rng(900 + i);
    return { departamento: dep, ciudad: cap, dias: ic.map((c, k) => ({ tmax: mx + (k ? Math.round((r() - .4) * 3) : 0), tmin: mn + (k ? Math.round((r() - .5) * 2) : 0), cielo: CIELO[c][0], descripcion: CIELO[c][1] })) };
  })
});

const D342 = ["Tumbes", "Piura", "Lambayeque", "La Libertad", "Áncash", "Lima", "Ica", "Arequipa", "Moquegua", "Tacna", "Cajamarca", "Huánuco", "Pasco", "Junín", "Huancavelica", "Ayacucho", "Apurímac", "Cusco", "Puno"];
const D343 = ["Loreto", "San Martín", "Ucayali", "Huánuco", "Junín"];
const año = new Date(B + OFF).getUTCFullYear(), EMI = HOY - DIA + 10 * H;
const meteoAvisos = sobre("meteo-avisos", EMI, "SENAMHI · Dirección de Meteorología (avisos meteorológicos)", {
  avisos: [
    {
      numero: 342, codigo: `342-${año}-SENAMHI/DMA`, nivel: "extrema", estado: "emitido", titulo: "INCREMENTO DE TEMPERATURA DIURNA EN LA COSTA Y SIERRA",
      emitido: iso(EMI), inicio: iso(HOY), fin: iso(HOY + 3 * DIA - 60000), duracion_h: 72, departamentos: D342,
      cuerpo: `El SENAMHI informa que, ${rango(HOY, HOY + 2 * DIA)}, continuará el incremento de la temperatura diurna, de moderada a extrema intensidad en la costa y de moderada a fuerte intensidad en la sierra del país. Se prevé escasa nubosidad hacia el mediodía, lo que contribuirá al aumento de los niveles de radiación ultravioleta (UV). Asimismo, se esperan ráfagas de viento con velocidades cercanas a los 40 km/h, principalmente durante las horas de la tarde. No se descarta la ocurrencia de lluvia localizada en la costa norte.`,
      dias: [
        { fecha: fecha(HOY), departamentos: D342, texto: "Se prevén temperaturas máximas entre 29 °C y 36 °C en la costa norte, entre 24 °C y 26 °C en la costa central y entre 22 °C y 29 °C en la costa sur. En la sierra, máximas entre 20 °C y 32 °C en el norte, entre 17 °C y 29 °C en el centro y entre 14 °C y 27 °C en el sur." },
        { fecha: fecha(HOY + DIA), departamentos: D342.filter(d => !["Cajamarca", "Pasco", "Huánuco"].includes(d)), texto: "Se prevén temperaturas máximas entre 29 °C y 36 °C en la costa norte, entre 24 °C y 28 °C en la costa central y entre 21 °C y 29 °C en la costa sur. En la sierra, máximas entre 18 °C y 32 °C en el norte, entre 17 °C y 28 °C en el centro y entre 14 °C y 26 °C en el sur." },
        { fecha: fecha(HOY + 2 * DIA), departamentos: ["Tumbes", "Piura", "Lambayeque", "Lima", "Ica", "Arequipa", "Moquegua", "Tacna", "Ayacucho", "Apurímac", "Cusco", "Puno"], texto: "Se prevén temperaturas máximas entre 29 °C y 36 °C en la costa norte, entre 24 °C y 29 °C en la costa central y entre 22 °C y 30 °C en la costa sur. En la sierra sur, registros entre 14 °C y 26 °C." }
      ]
    },
    {
      numero: 343, codigo: `343-${año}-SENAMHI/DMA`, nivel: "fuerte", estado: "emitido", titulo: "INCREMENTO DE TEMPERATURA DIURNA EN LA SELVA NORTE Y CENTRO",
      emitido: iso(EMI), inicio: iso(HOY + 10 * H), fin: iso(HOY + 2 * DIA - 60000), duracion_h: 38, departamentos: D343,
      cuerpo: `El SENAMHI informa que, ${rango(HOY, HOY + DIA)}, continuará el incremento de la temperatura diurna, de moderada a fuerte intensidad, en la selva norte y centro. Se prevé escasa cobertura nubosa durante el día, lo que favorecerá el aumento de la radiación ultravioleta (UV). Además, se esperan ráfagas de viento con velocidades cercanas a los 45 km/h, principalmente durante las horas de la tarde. No se descarta la ocurrencia de chubascos.`,
      dias: [
        { fecha: fecha(HOY), departamentos: D343, texto: "Se prevén temperaturas máximas entre 31 °C y 38 °C en la selva norte, y próximas a los 36 °C en la selva centro." },
        { fecha: fecha(HOY + DIA), departamentos: ["Loreto", "San Martín", "Ucayali"], texto: "Se prevén temperaturas máximas entre 30 °C y 36 °C en la selva norte." }
      ]
    },
    { numero: 341, nivel: "moderada", titulo: "LLUVIAS DE LIGERA A MODERADA INTENSIDAD EN LA SELVA", emitido: iso(HOY - 6 * DIA + 10 * H), inicio: iso(HOY - 5 * DIA + 13 * H), fin: iso(HOY - 3 * DIA - 60000), duracion_h: 35 },
    { numero: 340, nivel: "fuerte", titulo: "DESCENSO DE TEMPERATURA NOCTURNA EN LA SIERRA SUR", emitido: iso(HOY - 9 * DIA + 10 * H), inicio: iso(HOY - 8 * DIA), fin: iso(HOY - 6 * DIA + 9 * H), duracion_h: 57 },
    { numero: 339, nivel: "moderada", titulo: "INCREMENTO DE VIENTO EN LA COSTA", emitido: iso(HOY - 12 * DIA + 10 * H), inicio: iso(HOY - 11 * DIA + 10 * H), fin: iso(HOY - 9 * DIA - 60000), duracion_h: 38 }
  ]
});

/* ---------- publicación (cada «sistema productor» publica su archivo) ---------- */
fs.mkdirSync(repo, { recursive: true });
const PROD = [meteoMonitoreo, meteoPronostico, meteoAvisos, hidroMonitoreo, hidroPronostico, hidroAvisos];
for (const p of PROD) {
  const ent = publicar(repo, p, { frecuencia_min: FRECUENCIA[p.producto], demo: true });
  const kb = (fs.statSync(path.join(repo, ent.url)).size / 1024).toFixed(0);
  console.log(`✔ ${ent.id.padEnd(17)} → ${ent.url.padEnd(24)} ${kb.padStart(4)} KB · emitido ${ent.emitido}`);
}
console.log(`\nRepositorio de demostración listo en ${repo}`);

if (process.argv.includes("--continuo") && !fArg) {
  const { execFileSync } = await import("node:child_process");
  const otros = process.argv.slice(2).filter(a => a !== "--continuo");
  const esperar = () => M10 - (Date.now() % M10) + 5000; // 5 s después de cada múltiplo de 10 min
  const ciclo = () => setTimeout(() => {
    try { execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...otros], { stdio: "inherit" }); }
    catch { console.error("Falló una publicación; se reintenta en el próximo ciclo."); }
    ciclo();
  }, esperar());
  console.log("Modo continuo: se publicará cada 10 min (Ctrl+C para detener).");
  ciclo();
}
