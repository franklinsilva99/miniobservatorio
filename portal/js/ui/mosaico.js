/* Mosaico (vista compacta): una tarjeta por producto + mapa nacional con capas. */
import { M, VARS, vcol, nivelDep } from "../datos/modelo.js";
import { repo, salud } from "../datos/repositorio.js";
import { peru, chart, seriesPronostico, legItem, gauge } from "./graficos.js";
import { DEPS } from "../geo/peru.js";
import { ICON, LVN, LVC, LVI, chipAv, chipUm, fmt, norm, sentence, hm, esc } from "./util.js";
import { PRODS, DOMV, S, SALUD_C, emision } from "./estado.js";

const UML = [[1, "Normal"], [2, "Moderada"], [3, "Fuerte"], [4, "Extrema"], [0, "Sin datos"]];
const legLv = list => `<div class="leg">${list.map(([l, t]) => `<span><i style="background:${LVC(l)}"></i>${t}</span>`).join("")}</div>`;
const ramp = k => `<div><div class="ramp">${VARS[k].cols.map(c => `<i style="background:${c}"></i>`).join("")}</div><div class="ramp-l"><span>${VARS[k].lab[0]}</span><span>${VARS[k].u}</span><span>${VARS[k].lab[4]}</span></div></div>`;

const LAYERS = [["avm", "Avisos meteorológicos", "meteo-avisos"], ["avh", "Avisos hidrológicos", "hidro-avisos"], ["eh", "Estaciones hidrológicas", "hidro-monitoreo"], ["em", "Estaciones meteorológicas", "meteo-monitoreo"], ["pr", "Pronóstico T. máx.", "meteo-pronostico"]];

function pie(k) {
  const h = salud(k);
  return `<div class="t-f"><span>Fuente: ${M.fuente[k]}</span><span class="live" style="--dot:${SALUD_C[h.nivel]}" title="${esc(h.texto)}">${emision(k)}</span></div>`;
}
function aviso(k) {
  const h = salud(k);
  return ["ok", "cargando", "verificando"].includes(h.nivel) ? "" : `<div class="t-warn" style="--wc:${SALUD_C[h.nivel]}">${esc(h.texto)}</div>`;
}

function tile(k, cls, body, { tools = "", hero = false, style = "" } = {}) {
  const p = PRODS[k], [acc, soft] = DOMV[p.dom];
  return `<article class="card tile ${cls}${hero ? " hero" : ""}" data-k="${k}" style="--acc:${acc};--acc-soft:${soft};${style}">
    <div class="t-h"><div class="ic">${ICON[p.type]}</div><h3>${p.name}</h3><button class="exp" data-open="${k}" aria-label="Ampliar ${p.name}">${ICON.exp}<span>Ampliar</span></button></div>
    ${aviso(k)}${tools ? `<div class="t-tools">${tools}</div>` : ""}<div class="t-info">${body}</div>${pie(k)}</article>`;
}

/** Tarjeta de producto no disponible: nunca un hueco en blanco. */
function noDisp(k, cls) {
  const p = PRODS[k], [acc, soft] = DOMV[p.dom], h = salud(k);
  return `<article class="card tile ${cls} na" data-k="${k}" style="--acc:${acc};--acc-soft:${soft};cursor:default">
    <div class="t-h"><div class="ic">${ICON[p.type]}</div><h3>${p.name}</h3></div>
    <div class="t-info"><div class="empty">${h.nivel === "cargando" ? '<span class="spin" aria-hidden="true"></span>' : ICON.off}<b>${h.nivel === "cargando" ? "Cargando producto…" : "Producto no disponible"}</b><span>${h.nivel === "cargando" ? "Consultando el repositorio de productos." : esc(h.texto)}</span></div></div>${pie(k)}</article>`;
}

export const BENTO = {
  /* Tarjeta destacada: estación seleccionada, solo con las variables que registra */
  mon: () => {
    const K = "meteo-monitoreo"; if (!M.ok[K]) return noDisp(K, "a-mon");
    const e = M.EST.find(x => x.id === S.mmon.sel) || M.EST.find(x => x.n === "Unjf Sánchez Carrión") || M.EST[0]; S.mmon.sel = e.id;
    const mk = e.v.includes(S.mmon.var) ? S.mmon.var : e.v[0], V = VARS[mk], t = e.ser.T, act = e.v.filter(x => e.now[x] != null).length;
    const t24 = t && mk === "T" ? t.slice(-24).filter(v => v != null) : [];
    return tile(K, "a-mon", `
      <select data-est aria-label="Elegir estación">${M.EST.map(x => `<option value="${x.id}" ${x === e ? "selected" : ""}>${x.n} · ${x.dep}</option>`).join("")}</select>
      <div class="loc"><span class="now">● Dato de las ${hm(e.fecha)}</span><b style="margin-top:6px">${e.n}</b><span>${e.dep} · ${e.prov} · ${fmt(e.alt)} m s. n. m.</span></div>
      <div><div class="temp">${fmt(M.valor(e, mk), V.d)}<sup>${V.u}</sup></div><div style="font-size:12.5px;opacity:.85">${V.n}${mk === "PP" && e.d24.PP != null ? " acumulada 24 h" : ""}${t24.length ? ` · Máx ${fmt(Math.max(...t24), 1)}° · Mín ${fmt(Math.min(...t24), 1)}°` : ""}</div></div>
      <div class="vgrid">${e.v.map(x => `<button class="vbox ${x === mk ? "on" : ""}" data-mvar="${x}"><div class="l">${VARS[x].n}</div><div class="v">${fmt(M.valor(e, x), VARS[x].d)} <small>${VARS[x].u}${x === "PP" && e.d24.PP != null ? " · 24 h" : ""}</small></div></button>`).join("")}</div>
      <div class="reg">Esta estación registra <b>${e.v.length} de 4</b> variables: ${e.v.map(x => VARS[x].n.toLowerCase()).join(", ")}${act < e.v.length ? ` (${e.v.length - act} sin dato en esta emisión)` : ""}.<br>Red: ${M.EST.length} estaciones en el producto.</div>`, { hero: true });
  },

  map: () => {
    const L = S.lay, m = M.ok["meteo-avisos"] ? nivelDep() : {}, k = S.mmon.var, pts = [], d = S.mpro.day ?? M.diaHoyPr, okL = id => M.ok[LAYERS.find(x => x[0] === id)[2]];
    const on = id => L[id] && okL(id);
    if (on("em")) M.EST.forEach(e => { const has = e.v.includes(k) && M.valor(e, k) != null; pts.push({ k: "em", id: e.id, x: e.x, y: e.y, r: has ? 4.5 : 3.2, off: !has, c: has ? vcol(k, M.valor(e, k)) : "", t: `${e.n} · ${has ? fmt(M.valor(e, k), VARS[k].d) + " " + VARS[k].u : "sin dato de " + VARS[k].n.toLowerCase()}` }); });
    if (on("eh")) M.HST.forEach(s => pts.push({ k: "eh", sh: "d", id: s.id, x: s.x, y: s.y, r: 5, c: LVC(s.s), t: `Estación hidrológica ${s.n} · río ${s.rio} · ${LVN[s.s]}` }));
    if (on("avh")) M.HAV.filter(a => a.vig).forEach(a => pts.push({ k: "ah", sh: "ring", id: a.nro, x: a.s.x, y: a.s.y, r: 11, c: LVC(a.nivel), t: `Aviso hidrológico N° ${a.nro} · ${a.s.n} · ${LVN[a.nivel]}` }));
    const pr = on("pr") && M.CAPS.length;
    const fill = dp => on("avm") && m[norm(dp.n)] ? LVC(m[norm(dp.n)]) : pr && M.CAP(dp.n) ? vcol("T", M.CAP(dp.n).d[d]?.mx) : null;
    const labels = pr ? DEPS.filter(dp => dp.n !== "Callao" && M.CAP(dp.n)?.d[d]).map(dp => { const x = M.CAP(dp.n).d[d]; return { x: dp.cx, y: dp.cy + 3, t: `${x.e || ""}${fmt(x.mx)}°`, fs: 8 }; }) : [];
    const leg = [];
    if (on("avm") || on("avh") || on("eh")) leg.push(`<b>Nivel de peligro</b>${[2, 3, 4].map(l => `<span><i style="background:${LVC(l)}"></i>${LVN[l]}</span>`).join("")}`);
    if (on("eh") || on("avh")) leg.push(`${on("eh") ? `<span><i class="d" style="background:var(--l1);border:1px solid var(--pt-stroke)"></i>Estación hidrológica</span>` : ""}${on("avh") ? `<span><i class="c" style="border:2.5px solid var(--l3)"></i>Aviso hidrológico</span>` : ""}`);
    if (on("em")) leg.push(`<b>${VARS[k].n} (${VARS[k].u})</b>${ramp(k)}`);
    if (pr) leg.push(`<b>T. máx. · ${M.DIAS3c[d] || ""} (°C)</b>${ramp("T")}`);
    return `<section class="card tile a-map bigmap" aria-label="Mapa nacional con capas">
      <div class="layers" role="group" aria-label="Capas del mapa">${LAYERS.map(([id, t, p]) => `<button class="lay" data-lay="${id}" aria-pressed="${!!L[id] && !!M.ok[p]}" ${M.ok[p] ? "" : `disabled title="Producto no disponible"`}>${t}</button>`).join("")}</div>
      ${peru({ fill, pts, labels, click: true, aria: "Mapa nacional de avisos y estaciones", cls: "big" })}
      ${leg.length ? `<div class="legend">${leg.join("")}</div>` : ""}<span class="src">Toca una zona o estación para ver el detalle</span></section>`;
  },

  avm: () => {
    const K = "meteo-avisos"; if (!M.ok[K]) return noDisp(K, "a-avm");
    const v = M.MAV.filter(x => x.vig).sort((a, b) => b.nivel - a.nivel), a = v[0];
    if (!a) return tile(K, "a-avm", `<div class="empty ok"><b>Sin avisos meteorológicos vigentes</b><span>${M.MAV.length ? `Último aviso: N° ${M.MAV[0].num} (vencido el ${M.MAV[0].finC})` : "No hay avisos en el producto."}</span></div>`);
    return tile(K, "a-avm av-card", `
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between"><div><span class="av-badge">▲ ${LVN[a.nivel].toUpperCase()}</span> <span class="muted" style="font-size:12px;margin-left:4px">Aviso N° ${a.num}</span><div class="muted" style="font-size:12px;margin-top:4px">${v.length} aviso${v.length > 1 ? "s" : ""} vigente${v.length > 1 ? "s" : ""}</div></div>${gauge(a.nivel)}</div>
      <p class="av-t">${a.titulo}</p>
      <div style="font-size:12.5px">📅 ${a.iniC} → ${a.finC} · ${fmt(a.dur)} h · ${a.deps.length} departamentos</div>
      <div class="muted" style="font-size:12.5px">${a.recom}</div>
      <ul class="mini">${v.slice(1).map(x => `<li>${chipAv(x.nivel)}<span class="nm">N° ${x.num} · ${sentence(x.titulo)}</span></li>`).join("")}</ul>
      <div><button class="btn" data-lay="avm" style="border-radius:999px;color:var(--l4)">${S.lay.avm ? "Ocultar en el mapa" : "Mostrar en el mapa"}</button></div>`, { style: `--lc:${LVC(a.nivel)};--lci:${LVI(a.nivel)}` });
  },

  avh: () => {
    const K = "hidro-avisos"; if (!M.ok[K]) return noDisp(K, "a-avh");
    const v = M.HAV.filter(x => x.vig), c = l => v.filter(x => x.nivel === l).length;
    return tile(K, "a-avh", `
      <div style="display:flex;gap:12px;align-items:center"><div class="big">${v.length}</div><div style="font-size:12.5px;line-height:1.35">aviso${v.length === 1 ? "" : "s"} hidrológico${v.length === 1 ? "" : "s"} vigente${v.length === 1 ? "" : "s"} en el país<br><span class="muted">${[4, 3, 2].filter(c).map(l => `${c(l)} ${LVN[l].toLowerCase()}`).join(" · ") || "Sin avisos vigentes"}</span></div></div>
      <ul class="mini">${v.slice(0, 3).map(a => `<li>${chipAv(a.nivel)}<span class="nm">Río ${a.s.rio} · ${a.s.n}<small>${a.tipo === "avenida" ? "Avenida" : "Vaciante"} · vence ${a.vence}</small></span></li>`).join("")}</ul>
      ${v.length ? `<div><button class="btn" data-lay="avh" style="border-radius:999px;color:var(--acc)">${S.lay.avh ? "Ocultar en el mapa" : "Mostrar en el mapa"}</button></div>` : ""}`);
  },

  prm: () => {
    const K = "meteo-pronostico"; if (!M.ok[K]) return noDisp(K, "a-prm");
    const d = Math.min(S.mpro.day ?? M.diaHoyPr, M.FECHAS_PR.length - 1), c = M.CAPS.find(x => norm(x.cap) === norm(S.mpro.cap)) || M.CAPS[0];
    const hot = M.CAPS.reduce((a, b) => b.d[d].mx > a.d[d].mx ? b : a), cold = M.CAPS.reduce((a, b) => b.d[d].mn < a.d[d].mn ? b : a);
    return tile(K, "a-prm", `
      <select data-capt aria-label="Elegir capital">${M.CAPS.map(x => `<option ${x === c ? "selected" : ""}>${x.cap}</option>`).join("")}</select>
      <div class="days3" style="grid-template-columns:repeat(${Math.min(c.d.length, 3)},1fr)">${c.d.slice(0, 3).map((x, i) => `<button class="d3" data-mday="${i}" style="cursor:pointer;${i === d ? "border-color:var(--acc);background:var(--acc-soft)" : ""}"><div class="eyebrow" style="font-size:9.5px">${M.DIAS3c[i]}</div><div class="e">${x.e}</div><b><span class="tmax">${fmt(x.mx)}°</span> / <span class="tmin">${fmt(x.mn)}°</span></b></button>`).join("")}</div>
      <div class="muted" style="font-size:12px">${c.d[d].t}</div>
      <ul class="mini"><li><span class="nm">Más cálida · ${hot.cap}</span><b class="num tmax">${fmt(hot.d[d].mx)}°</b></li><li><span class="nm">Más fría · ${cold.cap}</span><b class="num tmin">${fmt(cold.d[d].mn)}°</b></li></ul>`);
  },

  mh: () => {
    const K = "hidro-monitoreo"; if (!M.ok[K]) return noDisp(K, "a-mh");
    const sob = M.HST.filter(s => s.s >= 2), top = [...M.HST].sort((a, b) => b.s - a.s || (b.q || 0) - (a.q || 0)).slice(0, 3);
    return tile(K, "a-mh", `
      <div style="display:flex;gap:12px;align-items:center"><div class="big">${sob.length}<small>de ${M.HST.length}</small></div><div style="font-size:12.5px">estaciones con nivel de peligro</div></div>
      <ul class="mini">${top.map(s => `<li><span class="sw" style="background:${LVC(s.s)}"></span><span class="nm">${s.n}<small>Río ${s.rio}</small></span><b class="num">${s.q == null ? "—" : fmt(s.q) + " m³/s"}</b></li>`).join("")}</ul>${legLv(UML)}`);
  },

  ph: () => {
    const K = "hidro-pronostico"; if (!M.ok[K]) return noDisp(K, "a-ph");
    const ids = Object.keys(M.HFC); if (!M.HFC[S.hpro.sel]) S.hpro.sel = ids.find(id => M.HFC[id].s >= 2) || ids[0];
    const f = M.HFC[S.hpro.sel], s = f.st, c = ids.filter(id => M.HFC[id].s >= 2).length, sp = seriesPronostico(f);
    return tile(K, "a-ph", `
      <div style="display:flex;gap:12px;align-items:center"><div class="big">${c}<small>de ${ids.length}</small></div><div style="font-size:12.5px">estaciones con pronóstico sobre umbral</div></div>
      <div style="font-size:12.5px"><b>${s.n}</b> · río ${s.rio} · ${f.lblPico.split(" ")[0]} ${fmt(f.pico)} m³/s el ${f.dpico} ${chipUm(f.s)}</div>
      ${chart({ ...sp, xl: [], thr: [{ v: s.u[0], c: LVC(2), l: "" }, { v: s.u[1], c: LVC(3), l: "" }], h: 110, mini: true, aria: `Mini hidrograma pronosticado de ${s.n}` })}
      <div class="chart-leg">${legItem("var(--acc)", "Observado")}${legItem("var(--acc)", "Pronóstico", 1)}</div>`);
  },

  /* Estado real de la recepción de productos (salud de cada archivo del repositorio) */
  st: () => {
    const c = repo.conexion, txt = { pendiente: "Conectando con el repositorio…", ok: "Repositorio de productos en línea", sin_conexion: "Sin conexión con el repositorio", error: "Error en el repositorio" }[c];
    const col = { pendiente: "var(--l0)", ok: "var(--l1)", sin_conexion: "var(--l3)", error: "var(--l4)" }[c];
    return `<section class="card tile a-st" style="cursor:default;--acc:var(--brand-2);--acc-soft:var(--brand-soft)">
      <div class="t-h"><div class="ic">●</div><h3>Estado del servicio</h3></div>
      <div class="t-info"><div style="font-size:12.5px"><span class="mode" style="display:inline-flex;--mc:${col}">● ${txt.toUpperCase()}</span>
        <div class="muted" style="margin-top:6px">${repo.verificado ? `Última verificación: ${hm(repo.verificado)} · <span data-rel="${repo.verificado.toISOString()}"></span>` : "Primera verificación en curso"}${repo.errorManifiesto ? `<br>${esc(repo.errorManifiesto)}` : ""}</div></div>
      <ul class="mini">${Object.entries(PRODS).map(([k, p]) => { const h = salud(k); return `<li><span class="sw" style="background:${SALUD_C[h.nivel]};border-color:${SALUD_C[h.nivel]}"></span><button class="nm" ${M.ok[k] ? `data-open="${k}"` : "disabled"} title="${esc(h.texto)}" style="border:0;background:none;padding:0;text-align:left;cursor:${M.ok[k] ? "pointer" : "default"};color:var(--text);font:inherit">${p.name}<small>${h.nivel === "ok" ? emision(k) : esc(h.texto)}</small></button></li>`; }).join("")}</ul></div></section>`;
  }
};

export const ORDEN = ["mon", "map", "avm", "avh", "prm", "mh", "ph", "st"];
