/* Utilidades de formato, fechas (hora de Lima) e iconos. Sin dependencias. */

export const $ = s => document.querySelector(s);

/** Escapa texto para insertarlo en HTML. Todo texto que llega de un producto pasa por aquí. */
export const esc = v => v == null ? "" : String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Formato numérico SI (Perú): coma decimal, espacio de miles, signo menos real. null → «—». */
export const fmt = (v, d) => {
  if (v == null || v === "" || !Number.isFinite(+v)) return "—";
  v = +v; d = d ?? (Number.isInteger(v) ? 0 : 1);
  const [i, f] = Math.abs(v).toFixed(d).split(".");
  return (v < 0 && +Math.abs(v).toFixed(d) !== 0 ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (f ? "," + f : "");
};
export const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const sentence = t => t.charAt(0) + t.slice(1).toLowerCase();
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

/* ---------- fechas: todo se muestra en hora de Lima (UTC−5) ---------- */
const TZ = "America/Lima";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const FP = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "long" });
const aFecha = x => x instanceof Date ? x : typeof x === "number" ? new Date(x) : /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(x + "T12:00:00-05:00") : new Date(x);
export function partes(x) { const o = {}; FP.formatToParts(aFecha(x)).forEach(p => o[p.type] = p.value); if (o.hour === "24") o.hour = "00"; return o; }
export const dm = x => { const p = partes(x); return `${p.day}/${p.month}`; };
export const hm = x => { const p = partes(x); return `${p.hour}:${p.minute}`; };
export const dmhm = x => `${dm(x)} ${hm(x)}`;
export const dmyhm = x => { const p = partes(x); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`; };
export const fechaLima = x => { const p = partes(x); return `${p.year}-${p.month}-${p.day}`; };
/** «Lunes 2 de noviembre» */
export const fechaLarga = x => { const p = partes(x); return `${cap(p.weekday)} ${+p.day} de ${MESES[+p.month - 1]}`; };
/** «lunes, 2 de noviembre de 2026 - 09:00 hrs» (formato de emisión de avisos) */
export const emisionLarga = x => { const p = partes(x); return `${p.weekday}, ${+p.day} de ${MESES[+p.month - 1]} de ${p.year} - ${p.hour}:${p.minute} hrs`; };
export const relojFecha = x => { const p = partes(x); return `${p.weekday.slice(0, 3)}, ${+p.day} ${MESES[+p.month - 1].slice(0, 3)}. ${p.year} · GMT−5`; };
/** «hace 5 min», «hace 3 h», «hace 2 d» */
export function relativo(iso, ahora = Date.now()) {
  const m = Math.round((ahora - Date.parse(iso)) / 60000);
  if (m < 1) return "hace instantes";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}
/** Etiqueta de un día de pronóstico respecto de hoy: {largo:"Hoy · lun 02/11", corto:"Hoy"} */
export function etiquetaDia(f, ahora = Date.now()) {
  const hoy = fechaLima(ahora), diff = Math.round((Date.parse(f + "T12:00:00-05:00") - Date.parse(hoy + "T12:00:00-05:00")) / 864e5);
  const p = partes(f), corto = `${p.weekday.slice(0, 3)} ${p.day}/${p.month}`;
  const rel = { 0: "Hoy", 1: "Mañana", 2: "Pasado" }[diff];
  return { largo: rel ? `${rel} · ${corto}` : cap(corto), corto: rel || cap(corto) };
}

/* ---------- niveles de peligro (nomenclatura del Observatorio) ---------- */
export const LVN = { 4: "Extrema", 3: "Fuerte", 2: "Moderada", 1: "Normal", 0: "Sin datos" };
export const chipAv = l => `<span class="chip lv-${l}">▲ ${LVN[l].toUpperCase()}</span>`;
export const chipUm = l => `<span class="chip lv-${l}">${LVN[l]}</span>`;
export const LVC = l => `var(--l${l})`;
export const LVI = l => l === 2 || l === 3 ? "#1b1b1b" : "#fff";

/* ---------- iconos (SVG en línea, sin peticiones externas) ---------- */
const sv = (p, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICON = {
  hidro: sv('<path d="M12 2.7S6 9.3 6 14a6 6 0 0 0 12 0c0-4.7-6-11.3-6-11.3z"/>', 18),
  meteo: sv('<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 12.5 3.5 3.5 0 0 1 17.5 19z"/>', 18),
  mon: sv('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  pro: sv('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/><path d="M16 8h4v4"/>'),
  avi: sv('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  exp: sv('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>', 14, 2.2),
  off: sv('<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2-1.5"/><path d="M12 20h.01"/>', 18)
};
