/* Mapa del Perú, gráficos de series e indicador de nivel, en SVG puro (sin librerías). */
import { PERU, DEPS } from "../geo/peru.js";
import { fmt, LVC, LVN } from "./util.js";

/**
 * Mapa departamental con puntos y etiquetas.
 * pts: {id,k,x,y,r,c,t,sh:"d"|"ring"|undefined,sel,off}
 */
export function peru({ fill, pts = [], labels = [], click = false, aria = "Mapa del Perú", cls = "" } = {}) {
  const deps = DEPS.map(d => {
    const f = fill && fill(d);
    return `<path class="dep${click && f ? " click" : ""}" d="${d.d}" data-dep="${d.n}" fill="${f || "var(--map-land)"}" fill-opacity="${f ? .78 : 1}" stroke="var(--map-stroke)" stroke-width=".55" stroke-linejoin="round" fill-rule="evenodd"><title>${d.n}</title></path>`;
  }).join("");
  const p = pts.map(q => {
    const a = `data-id="${q.id}" data-k="${q.k || ""}"`, r = q.r || 5;
    if (q.sh === "d") return `<rect class="pt${q.sel ? " sel" : ""}" ${a} x="${q.x - r}" y="${q.y - r}" width="${2 * r}" height="${2 * r}" transform="rotate(45 ${q.x} ${q.y})" fill="${q.c}"><title>${q.t}</title></rect>`;
    if (q.sh === "ring") return `<circle class="pt" ${a} cx="${q.x}" cy="${q.y}" r="${r}" fill="none" style="stroke:${q.c};stroke-width:3"><title>${q.t}</title></circle>`;
    return `<circle class="pt${q.off ? " off" : ""}${q.sel ? " sel" : ""}" ${a} cx="${q.x}" cy="${q.y}" r="${r}" fill="${q.off ? "none" : q.c}"><title>${q.t}</title></circle>`;
  }).join("");
  const l = labels.map(q => `<text x="${q.x}" y="${q.y}" font-size="${q.fs || 7}" text-anchor="middle" fill="var(--text)" font-weight="600" stroke="var(--map-water)" stroke-width="2.2" paint-order="stroke">${q.t}</text>`).join("");
  return `<svg ${cls ? `class="${cls}" ` : ""}viewBox="-6 -6 ${PERU.w + 12} ${PERU.h + 12}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}"><text x="14" y="300" font-size="9" font-style="italic" fill="var(--map-stroke)" transform="rotate(-62 14 300)">Océano Pacífico</text>${deps}${p}${l}</svg>`;
}

/** Gráfico de líneas/barras con umbrales, bandas y separación observado/pronóstico. */
export function chart({ ser, thr = [], bands = [], band = null, split = null, xl = [], h = 190, zero = false, mini = false, aria = "" }) {
  const W = 360, H = h, P = mini ? { l: 4, r: 4, t: 6, b: 6 } : { l: 42, r: 12, t: 12, b: 24 };
  const n = Math.max(2, ...ser.map(s => s.v.length));
  const all = []; ser.forEach(s => s.v.forEach(x => x != null && all.push(x))); thr.forEach(t => all.push(t.v)); if (band) band.forEach(b => b && all.push(b[0], b[1]));
  if (!all.length) return `<p class="muted" style="font-size:12.5px;margin:0">Sin datos para graficar.</p>`;
  let mn = Math.min(...all), mx = Math.max(...all); const pad = (mx - mn) * .14 || 1; mn -= pad; mx += pad; if (zero) mn = 0;
  const X = i => P.l + i * (W - P.l - P.r) / (n - 1), Y = v => P.t + (mx - v) * (H - P.t - P.b) / (mx - mn), dec = mx - mn < 8 ? 1 : 0;
  let g = "";
  for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3; g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--border)"/>` + (mini ? "" : `<text x="${P.l - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="var(--muted)">${fmt(v, dec)}</text>`); }
  bands.forEach(b => { const a = Math.max(Math.min(b.from, b.to), mn), z = Math.min(Math.max(b.from, b.to), mx); if (z > a) g += `<rect x="${P.l}" width="${W - P.l - P.r}" y="${Y(z)}" height="${Y(a) - Y(z)}" fill="${b.c}" fill-opacity=".22"/>`; });
  if (band) { const idx = band.map((b, i) => b ? i : -1).filter(i => i >= 0); g += `<polygon points="${idx.map(i => `${X(i)},${Y(band[i][1])}`).join(" ")} ${idx.slice().reverse().map(i => `${X(i)},${Y(band[i][0])}`).join(" ")}" fill="var(--acc)" fill-opacity=".16"/>`; }
  thr.forEach(t => { g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t.v)}" y2="${Y(t.v)}" stroke="${t.c}" stroke-dasharray="5 3" stroke-width="1.4"/><text x="${W - P.r - 2}" y="${Y(t.v) - 3}" text-anchor="end" font-size="8.5" font-weight="600" fill="${t.c}" stroke="var(--surface)" stroke-width="2.5" paint-order="stroke">${t.l}</text>`; });
  ser.forEach(s => {
    if (s.bar) { const bw = (W - P.l - P.r) / n * .7; s.v.forEach((v, i) => { if (v > 0) g += `<rect x="${X(i) - bw / 2}" y="${Y(v)}" width="${bw}" height="${Y(mn) - Y(v)}" fill="${s.c}"/>`; }); return; }
    let d = "", on = false; s.v.forEach((v, i) => { if (v == null) { on = false; return; } d += (on ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); on = true; });
    g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2.2}" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="5 4"' : ""}/>`;
    if (s.pts) s.v.forEach((v, i) => { if (v != null) g += `<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" fill="${s.c}"/>`; });
  });
  if (split != null) g += `<line x1="${X(split)}" x2="${X(split)}" y1="${P.t}" y2="${H - P.b}" stroke="var(--muted)" stroke-dasharray="2 2"/>`;
  xl.forEach(([i, t], k) => g += `<text x="${X(i)}" y="${H - 7}" text-anchor="${k === 0 ? "start" : k === xl.length - 1 ? "end" : "middle"}" font-size="9" fill="var(--muted)">${t}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${aria}">${g}</svg>`;
}

/** Series de un pronóstico hidrológico: observado (línea), pronóstico (discontinua) y banda mín–máx. */
export function seriesPronostico(f, pts = false) {
  const nO = f.obs.length, nF = f.avg.length, last = nO ? f.obs[nO - 1] : null, pad = k => Array(Math.max(k, 0)).fill(null);
  const rangos = f.min.map((m, i) => m == null ? null : [m, f.max[i]]);
  return {
    ser: [{ v: [...f.obs, ...pad(nF)], c: "var(--acc)", pts }, { v: [...pad(nO - 1), ...(nO ? [last] : []), ...f.avg], c: "var(--acc)", dash: true, pts }],
    band: [...pad(nO - 1), ...(nO ? [last == null ? null : [last, last]] : []), ...rangos],
    split: nO ? nO - 1 : null,
    xl: nO ? [[0, f.fObs[0]], [nO - 1, "Hoy"], [nO + nF - 1, f.fFc[nF - 1]]] : [[0, f.fFc[0]], [nF - 1, f.fFc[nF - 1]]]
  };
}

export const legItem = (c, t, dash) => `<span style="color:${c}"><i class="${dash ? "dash" : ""}" style="background:${c}"></i><span class="muted">${t}</span></span>`;

/** Indicador semicircular del nivel de peligro (como la tarjeta de aviso del Observatorio). */
export function gauge(l) {
  const p = (a, r) => [32 + r * Math.cos(a * Math.PI / 180), 32 - r * Math.sin(a * Math.PI / 180)];
  const arc = (a0, a1) => { const [x0, y0] = p(a0, 26), [x1, y1] = p(a1, 26); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A26 26 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const [nx, ny] = p({ 2: 150, 3: 90, 4: 30 }[l] || 150, 19);
  return `<svg class="gauge" width="72" height="43" viewBox="0 0 64 38" role="img" aria-label="Nivel de peligro ${LVN[l]}">${[[2, 180, 120], [3, 120, 60], [4, 60, 0]].map(([lv, a0, a1]) => `<path d="${arc(a0, a1)}" stroke="${LVC(lv)}" stroke-width="8" fill="none"/>`).join("")}<line x1="32" y1="32" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="var(--text)"/></svg>`;
}
