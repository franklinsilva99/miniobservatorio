/* Vistas ampliadas: mapa a la izquierda + panel de detalle a la derecha. */
import { M, VARS, VARK, vcol, nivelDep, estadoUmbral, agregarDiario } from "../datos/modelo.js";
import { urlRepositorio } from "../datos/repositorio.js";
import { DEPS } from "../geo/peru.js";
import { peru, chart, seriesPronostico, legItem } from "./graficos.js";
import { LVN, LVC, chipAv, chipUm, fmt, norm, emisionLarga, esc, ICON } from "./util.js";
import { S } from "./estado.js";

const UML = [[1, "Normal"], [2, "Moderada"], [3, "Fuerte"], [4, "Extrema"], [0, "Sin datos"]];
const panelCard = (h, b, cls = "") => `<div class="card ${cls}">${h ? `<div class="p-h">${h}</div>` : ""}<div class="p-b">${b}</div></div>`;
const docLink = doc => { const u = doc && urlRepositorio(doc); return u ? `<p style="margin:12px 0 0"><a class="btn primary" href="${esc(u)}" target="_blank" rel="noopener">⬇ Descargar documento oficial</a></p>` : ""; };
const vacio = t => ({ map: peru({ aria: "Mapa del Perú" }), panel: panelCard("", `<div class="empty">${ICON.off}<b>Producto no disponible</b><span>${t}</span></div>`) });

export const DET = {
  "hidro-monitoreo": () => {
    if (!M.HST.length) return vacio("No hay estaciones en el producto.");
    const s = M.HS(S.hmon.sel) || [...M.HST].sort((a, b) => b.s - a.s)[0]; S.hmon.sel = s.id;
    const hayN = !!(s.un && s.serN.length && s.niv != null); if (!hayN) S.hmon.var = "Q";
    const isQ = S.hmon.var === "Q", u = isQ ? s.u : s.un, unit = isQ ? "m³/s" : "m", val = isQ ? s.q : s.niv;
    let ser = isQ ? s.serQ : s.serN, xl = [[0, `−${ser.length} h`], [Math.floor(ser.length / 2), `−${Math.ceil(ser.length / 2)} h`], [ser.length - 1, "Ahora"]];
    if (S.hmon.agg === "d" && ser.length && s.serIni) { const a = agregarDiario(ser, s.serIni, s.paso); ser = a.v; xl = a.l.map((t, i) => [i, t]); }
    const st = estadoUmbral(val, u, s.tipo), prox = val == null ? null : s.tipo === "vaciante" ? u.find(x => val > x) : u.find(x => val < x);
    return {
      legend: `<b>Estado por umbral</b>${UML.map(([l, t]) => `<span><i style="background:${LVC(l)}"></i>${t}</span>`).join("")}`,
      map: peru({ pts: M.HST.map(x => ({ id: x.id, x: x.x, y: x.y, r: x.id === s.id ? 9 : 7, sel: x.id === s.id, c: LVC(x.s), t: `${x.n} · ${LVN[x.s]}` })), labels: M.HST.map(x => ({ x: x.x, y: x.y - 11, t: x.n })), aria: "Mapa de estaciones hidrológicas" }),
      panel: panelCard(`<div><div class="eyebrow">Estación seleccionada</div><h3>Hidrograma de ${isQ ? "caudal" : "nivel"} del río ${s.rio}</h3><span class="muted" style="font-size:12.5px">Estación ${s.n} · ${s.dep}</span></div>${chipUm(s.s)}`,
        s.q == null ? `<p class="txt muted">Estación sin datos en esta emisión (mantenimiento o falla de transmisión).</p>` :
          `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="seg" role="group" aria-label="Variable"><button data-hvar="Q" class="${isQ ? "on" : ""}">Caudal</button><button data-hvar="N" class="${!isQ ? "on" : ""}" ${hayN ? "" : "disabled title=\"La estación no envía nivel\""}>Nivel</button></div><div class="seg" role="group" aria-label="Agregación"><button data-hagg="h" class="${S.hmon.agg === "h" ? "on" : ""}">Horario</button><button data-hagg="d" class="${S.hmon.agg === "d" ? "on" : ""}">Diario</button></div></div>
        <div class="kpis"><div class="kpi"><div class="v">${fmt(val, isQ ? 1 : 2)}</div><div class="l">${unit} · actual</div></div><div class="kpi"><div class="v" style="color:${LVC(st || 1)}">${st >= 2 ? LVN[st] : "Normal"}</div><div class="l">${prox != null ? `próximo umbral: ${fmt(prox, isQ ? 0 : 2)} ${unit}` : "sobre umbral extrema"}</div></div></div>
        <div style="margin-top:10px">${chart({ ser: [{ v: ser, c: "var(--acc)", pts: S.hmon.agg === "d" }], thr: [{ v: u[0], c: LVC(2), l: "Moderada" }, { v: u[1], c: LVC(3), l: "Fuerte" }, { v: u[2], c: LVC(4), l: "Extrema" }], xl, aria: `Hidrograma de ${s.n}` })}</div>
        <div class="chart-leg">${legItem("var(--acc)", S.hmon.agg === "d" ? "Promedio diario" : "Datos horarios")}${legItem(LVC(2), "Umbral moderada", 1)}${legItem(LVC(3), "Umbral fuerte", 1)}${legItem(LVC(4), "Umbral extrema", 1)}</div>
        <p class="note" style="margin-top:10px">Información en tiempo casi real, sujeta a revisión y validación. Umbrales de tipo <b>${s.tipo}</b>${s.tipo === "vaciante" ? " (alerta cuando el valor baja)" : ""}.</p>`) +
        panelCard(`<h3>Ficha de la estación</h3>`, `<dl class="dl"><dt>Río</dt><dd>${s.rio}</dd><dt>Cuenca</dt><dd>${s.cuenca}</dd><dt>Región hidrográfica</dt><dd>${s.reg}</dd><dt>Departamento</dt><dd>${s.dep}</dd><dt>Provincia</dt><dd>${s.prov}</dd><dt>Distritos</dt><dd>${s.dist.join(", ")}</dd></dl>`) +
        panelCard(`<h3>Estaciones (${M.HST.length})</h3><span class="muted" style="font-size:12px">ordenadas por estado</span>`, `<table class="tb"><thead><tr><th>Estación</th><th class="num">Caudal (m³/s)</th><th>Estado</th></tr></thead><tbody>${[...M.HST].sort((a, b) => b.s - a.s).map(x => `<tr data-sel="${x.id}" class="${x.id === s.id ? "sel" : ""}"><td><b>${x.n}</b><br><span class="muted">Río ${x.rio}</span></td><td class="num">${fmt(x.q)}</td><td>${chipUm(x.s)}</td></tr>`).join("")}</tbody></table>`)
    };
  },

  "hidro-pronostico": () => {
    const ids = Object.keys(M.HFC); if (!ids.length) return vacio("No hay estaciones con pronóstico.");
    if (!M.HFC[S.hpro.sel]) S.hpro.sel = ids[0];
    const id = S.hpro.sel, f = M.HFC[id], s = f.st, sp = seriesPronostico(f, true);
    // estaciones del monitoreo que no tienen pronóstico se muestran apagadas
    const otros = M.HST.filter(x => !M.HFC[x.id]);
    return {
      legend: `<b>Estaciones con pronóstico</b><span><i style="background:var(--acc)"></i>Pronóstico disponible</span>${otros.length ? `<span><i style="background:var(--map-land);border:1px solid var(--map-stroke)"></i>Sin pronóstico</span>` : ""}`,
      map: peru({ pts: [...ids.map(k => { const x = M.HFC[k].st; return { id: k, x: x.x, y: x.y, r: k === id ? 9 : 6, sel: k === id, c: "var(--acc)", t: x.n }; }), ...otros.map(x => ({ id: x.id, x: x.x, y: x.y, r: 6, off: true, t: `${x.n} · sin pronóstico` }))], labels: ids.map(k => ({ x: M.HFC[k].st.x, y: M.HFC[k].st.y - 11, t: M.HFC[k].st.n })), aria: "Mapa de estaciones con pronóstico" }),
      panel: panelCard(`<div><div class="eyebrow">Pronóstico diario</div><h3>Caudal pronosticado del río ${s.rio}</h3><span class="muted" style="font-size:12.5px">Estación ${s.n}</span></div>${chipUm(f.s)}`,
        `<div class="kpis"><div class="kpi"><div class="v">${fmt(f.pico)}</div><div class="l">m³/s · ${f.lblPico} (${f.dpico})</div></div><div class="kpi"><div class="v" style="color:${LVC(f.s || 1)}">${f.s >= 2 ? "Sí" : "No"}</div><div class="l">${f.s >= 2 ? "supera umbral " + LVN[f.s].toLowerCase() : "supera umbral"} en el horizonte</div></div></div>
        <div style="margin-top:10px">${chart({ ...sp, thr: [{ v: s.u[0], c: LVC(2), l: "Moderada" }, { v: s.u[1], c: LVC(3), l: "Fuerte" }, { v: s.u[2], c: LVC(4), l: "Extrema" }], aria: `Caudal observado y pronosticado de ${s.n}` })}</div>
        <div class="chart-leg">${legItem("var(--acc)", "Caudal promedio observado")}${legItem("var(--acc)", `Caudal pronosticado (promedio de ${f.modelos.length} modelo${f.modelos.length > 1 ? "s" : ""})`, 1)}<span><i style="background:var(--acc);opacity:.25;height:8px"></i><span class="muted">Mín – Máx de modelos</span></span></div>`) +
        panelCard(`<h3>Pronóstico por modelo (m³/s)</h3>`, `<div style="overflow-x:auto"><table class="tb"><thead><tr><th>Fecha</th>${f.modelos.map(n => `<th class="num">${n}</th>`).join("")}<th class="num">Prom.</th><th>Estado</th></tr></thead><tbody>${f.m.map((d, i) => `<tr><td>${f.fFc[i]}</td>${d.map(v => `<td class="num">${fmt(v, 1)}</td>`).join("")}<td class="num"><b>${fmt(f.avg[i])}</b></td><td>${chipUm(estadoUmbral(f.avg[i], s.u, s.tipo))}</td></tr>`).join("")}</tbody></table></div>`) +
        panelCard(`<h3>Estaciones con pronóstico</h3>`, `<table class="tb"><thead><tr><th>Estación</th><th class="num">Crítico (m³/s)</th><th>Estado</th></tr></thead><tbody>${ids.map(k => `<tr data-sel="${k}" class="${k === id ? "sel" : ""}"><td><b>${M.HFC[k].st.n}</b><br><span class="muted">Río ${M.HFC[k].st.rio}</span></td><td class="num">${fmt(M.HFC[k].pico)}</td><td>${chipUm(M.HFC[k].s)}</td></tr>`).join("")}</tbody></table>`)
    };
  },

  "hidro-avisos": () => {
    const F = S.havi.f, pasa = a => F === "todos" || (F === "vig" ? a.vig : a.nivel === +F), list = M.HAV.filter(pasa);
    let a = M.HAV.find(x => x.nro === S.havi.sel); if (!list.includes(a)) a = list[0];
    const s = a?.s, u = s?.u, cnt = f => M.HAV.filter(x => f === "todos" || (f === "vig" ? x.vig : x.nivel === +f)).length;
    const bands = a ? (a.tipo === "avenida" ? [{ from: u[0], to: u[1], c: LVC(2) }, { from: u[1], to: u[2], c: LVC(3) }, { from: u[2], to: u[2] * 1.5, c: LVC(4) }] : [{ from: u[0], to: u[1], c: LVC(2) }, { from: u[1], to: u[2], c: LVC(3) }, { from: u[2], to: 0, c: LVC(4) }]) : [];
    const n = a?.serie?.length || 0;
    return {
      legend: `<b>Nivel del aviso</b>${[4, 3, 2].map(l => `<span><i style="background:${LVC(l)}"></i>${LVN[l]}</span>`).join("")}`,
      map: peru({ fill: d => a && norm(a.s.dep) === norm(d.n) ? LVC(a.nivel) : null, pts: M.HAV.filter(x => x.vig).map(x => ({ id: x.nro, x: x.s.x, y: x.s.y, r: x === a ? 9 : 7, sel: x === a, c: LVC(x.nivel), t: `Aviso N° ${x.nro} · ${x.s.n}` })), labels: M.HAV.filter(x => x.vig).map(x => ({ x: x.s.x, y: x.s.y - 11, t: x.s.n })), aria: "Mapa de avisos hidrológicos" }),
      panel: panelCard("", `<div class="chips" role="group" aria-label="Filtro rápido">${[["todos", "Todos"], ["4", "Extrema"], ["3", "Fuerte"], ["2", "Moderada"], ["vig", "Vigentes"]].map(([k, t]) => `<button class="chip ${F === k ? (+k ? "lv-" + k : "lv-0") : "ghost"}" data-hf="${k}" aria-pressed="${F === k}">${t} (${cnt(k)})</button>`).join("")}</div>
        <div class="alist" style="margin-top:12px">${list.map(x => `<button class="aitem ${x === a ? "on" : ""} ${x.vig ? "" : "old"}" style="--lc:${LVC(x.nivel)}" data-av="${x.nro}"><div class="chips">${chipAv(x.nivel)}<span class="chip ghost">N° ${x.nro}</span>${x.vig ? "" : `<span class="chip ghost">${x.cancelado ? "Cancelado" : "Vencido"}</span>`}</div><b>${x.titulo}</b><small>${x.ini} → ${x.vence} · ${fmt(x.dur)} h · ${x.tipo === "avenida" ? "Avenida" : "Vaciante"}</small></button>`).join("") || '<p class="muted">Sin avisos para el filtro seleccionado.</p>'}</div>`, "after") +
        (a ? panelCard(`<div><div class="eyebrow">Aviso N° ${a.nro} · emitido ${emisionLarga(a.emitido)}</div><h3>${a.titulo}</h3></div>${chipAv(a.nivel)}`,
          `<dl class="dl"><dt>Fecha de inicio</dt><dd>${a.ini}</dd><dt>Fecha de final</dt><dd>${a.vence}</dd><dt>Plazo</dt><dd>${a.plazo} · ${fmt(a.dur)} h</dd><dt>Tipo</dt><dd>${a.tipo === "avenida" ? "Avenida" : "Vaciante"}</dd></dl>
        <p class="txt" style="margin-top:10px">${a.desc}</p>
        ${n ? `<div style="margin-top:10px">${chart({ ser: [{ v: a.serie, c: "#1d4ed8" }], bands, xl: [[0, `−${n} h`], [Math.floor(n / 2), `−${Math.ceil(n / 2)} h`], [n - 1, "Emisión"]], aria: `Hidrograma del aviso ${a.nro}` })}</div>
        <div class="chart-leg">${legItem("#1d4ed8", `${a.var === "nivel" ? "Nivel" : "Caudal"} (${a.uni})`)}<span><i style="background:${LVC(2)};opacity:.5;height:8px"></i><span class="muted">Umbral moderada</span></span><span><i style="background:${LVC(3)};opacity:.5;height:8px"></i><span class="muted">Fuerte</span></span><span><i style="background:${LVC(4)};opacity:.5;height:8px"></i><span class="muted">Extrema</span></span></div>` : ""}
        <table class="tb" style="margin-top:10px"><thead><tr><th>Cuerpo de agua</th><th>Estación</th><th class="num">${a.var === "nivel" ? "Nivel" : "Caudal"} (${a.uni})</th><th class="num">Umbral extrema</th></tr></thead><tbody><tr><td>Río ${s.rio}</td><td>${s.n}</td><td class="num">${fmt(a.val, 2)}</td><td class="num">${fmt(u[2])}</td></tr></tbody></table>${docLink(a.doc)}`) +
          panelCard(`<h3>Zonas de posible afectación</h3>`, `<dl class="dl"><dt>Centros poblados</dt><dd>${s.pob.join(", ") || "—"}</dd><dt>Departamento</dt><dd>${s.dep}</dd><dt>Provincia</dt><dd>${s.prov}</dd><dt>Distritos</dt><dd>${s.dist.join(", ")}</dd></dl>
        <div class="pr" style="margin-top:12px;--lc:${LVC(a.nivel)}"><div><b>Peligro</b>${a.peligro}</div><div><b>Recomendación</b>${a.recom}</div></div>`) : "")
    };
  },

  "meteo-monitoreo": () => {
    if (!M.EST.length) return vacio("No hay estaciones en el producto.");
    const k = S.mmon.var, V = VARS[k];
    const e = M.EST.find(x => x.id === S.mmon.sel) || M.EST.find(x => x.n === "Unjf Sánchez Carrión") || M.EST[0];
    const ek = e.v.includes(k) ? k : e.v[0], EV = VARS[ek], has = x => x.v.includes(k) && M.valor(x, k) != null;
    const rank = M.EST.filter(has).sort((a, b) => M.valor(b, k) - M.valor(a, k)).slice(0, 8), sr = e.ser[ek] || [];
    return {
      legend: `<b>${V.n} (${V.u})</b>${V.cols.map((c, i) => `<span><i style="background:${c};border:1px solid var(--map-stroke)"></i>${V.lab[i]}</span>`).join("")}<span><i style="border:1.5px dashed var(--muted)"></i>No registra / sin dato</span>`,
      map: peru({ pts: M.EST.map(x => { const on = has(x); return { id: x.id, x: x.x, y: x.y, r: x.id === e.id ? 7 : on ? 5 : 3.5, sel: x.id === e.id, off: !on, c: on ? vcol(k, M.valor(x, k)) : "", t: `${x.n} · ${on ? fmt(M.valor(x, k), V.d) + " " + V.u : "sin dato"}` }; }), aria: "Mapa de estaciones meteorológicas" }),
      tools: `<div class="seg" role="group" aria-label="Variable del mapa">${VARK.map(x => `<button data-mvar="${x}" class="${x === k ? "on" : ""}">${VARS[x].n}</button>`).join("")}</div>`,
      panel: panelCard(`<div><div class="eyebrow">Estación ${e.id}</div><h3>${e.n}</h3><span class="muted" style="font-size:12.5px">${e.dep} · ${e.prov} · ${fmt(e.alt)} m s. n. m.</span></div>`,
        `<p style="margin:0 0 10px;font-size:12.5px">Esta estación registra: ${e.v.map(x => `<span class="chip ghost">${VARS[x].n}</span>`).join(" ")}</p>
        <div class="vcards">${e.v.map(x => `<button class="vcard ${x === ek ? "on" : ""}" data-evar="${x}"><div class="l">${VARS[x].n}${x === "PP" && e.d24.PP != null ? " · 24 h" : ""}</div><div class="v">${fmt(M.valor(e, x), VARS[x].d)} <small style="font-size:12px;font-weight:500">${VARS[x].u}</small></div>${x === "PP" ? `<div class="l">última hora: ${fmt(e.now.PP, 1)} mm</div>` : e.d24[x] != null ? `<div class="l">${e.d24[x] >= 0 ? "▲" : "▼"} ${fmt(Math.abs(e.d24[x]), VARS[x].d)} vs. hace 24 h</div>` : ""}</button>`).join("")}</div>
        <div style="margin-top:12px"><div class="eyebrow" style="margin-bottom:4px">${EV.n} · últimas ${sr.length} h (${EV.u})</div>${chart({ ser: [{ v: sr, c: "var(--acc)", bar: EV.bar }], zero: EV.zero, xl: sr.length ? [[0, `−${sr.length} h`], [Math.floor(sr.length / 2), `−${Math.ceil(sr.length / 2)} h`], [sr.length - 1, "Ahora"]] : [], aria: `${EV.n} en ${e.n}` })}</div>
        <p class="note" style="margin-top:8px">Dato horario de estación automática, sujeto a control de calidad.</p>`) +
        panelCard(`<h3>${k === "T" || k === "V" ? "Valores más altos" : "Mayores registros"} · ${V.n}</h3>`, `<table class="tb"><thead><tr><th>Estación</th><th class="num">${V.u}</th></tr></thead><tbody>${rank.map(x => `<tr data-sel="${x.id}" class="${x.id === e.id ? "sel" : ""}"><td><b>${x.n}</b><br><span class="muted">${x.dep}</span></td><td class="num">${fmt(M.valor(x, k), V.d)}</td></tr>`).join("") || `<tr><td colspan="2" class="muted">Ninguna estación reporta esta variable.</td></tr>`}</tbody></table>`)
    };
  },

  "meteo-pronostico": () => {
    if (!M.CAPS.length) return vacio("No hay ciudades en el producto.");
    const d = Math.min(S.mpro.day ?? M.diaHoyPr, M.FECHAS_PR.length - 1), c = M.CAPS.find(x => norm(x.cap) === norm(S.mpro.cap)) || M.CAPS[0];
    return {
      legend: `<b>Temperatura máxima · ${M.DIAS3c[d]}</b>${VARS.T.cols.map((col, i) => `<span><i style="background:${col};border:1px solid var(--map-stroke)"></i>${VARS.T.lab[i]} °C</span>`).join("")}`,
      tools: `<div class="seg" role="group" aria-label="Día">${M.DIAS3.map((t, i) => `<button data-mday="${i}" class="${i === d ? "on" : ""}">${t}</button>`).join("")}</div>`,
      map: peru({ click: true, fill: dp => { const x = M.CAP(dp.n); return x?.d[d] ? vcol("T", x.d[d].mx) : null; }, labels: DEPS.filter(x => M.CAP(x.n)?.d[d]).map(x => ({ x: x.cx, y: x.cy + 3, t: M.CAP(x.n).d[d].e, fs: x.n === "Callao" ? 0 : 10 })), aria: "Mapa de pronóstico por departamento" }),
      hint: "Toca un departamento para ver su pronóstico",
      panel: panelCard(`<div><div class="eyebrow">Pronóstico · ${c.dep}</div><h3>${c.cap}</h3></div><select data-cap aria-label="Capital">${M.CAPS.map(x => `<option ${x === c ? "selected" : ""}>${x.cap}</option>`).join("")}</select>`,
        `<div class="alist">${c.d.map((x, i) => `<div class="aitem" style="--lc:${i === d ? "var(--acc)" : "var(--border)"};cursor:default"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:30px">${x.e}</span><div style="flex:1"><div class="eyebrow">${M.DIAS3[i]}</div><b style="margin:2px 0"><span class="tmax">Máx ${fmt(x.mx)} °C</span> · <span class="tmin">Mín ${fmt(x.mn)} °C</span></b><small>${x.t}</small></div></div></div>`).join("")}</div>`) +
        panelCard(`<h3>Capitales de departamento · ${M.DIAS3c[d]}</h3>`, `<table class="tb"><thead><tr><th>Ciudad</th><th></th><th class="num">Máx</th><th class="num">Mín</th></tr></thead><tbody>${M.CAPS.map(x => `<tr data-cap="${x.cap}" class="${x === c ? "sel" : ""}"><td><b>${x.cap}</b><br><span class="muted">${x.dep}</span></td><td style="font-size:18px">${x.d[d].e}</td><td class="num tmax">${fmt(x.d[d].mx)}°</td><td class="num tmin">${fmt(x.d[d].mn)}°</td></tr>`).join("")}</tbody></table>`)
    };
  },

  "meteo-avisos": () => {
    const vig = M.MAV.filter(x => x.vig).sort((a, b) => b.nivel - a.nivel || b.num - a.num);
    if (S.mavi.tab == null) S.mavi.tab = vig[0]?.num ?? 0;
    const a = vig.find(x => x.num === S.mavi.tab);
    const tabs = `<div class="tabs" role="tablist">${vig.map(x => `<button role="tab" data-mtab="${x.num}" class="${x.num === S.mavi.tab ? "on" : ""}">Aviso N° ${x.num}</button>`).join("")}<button role="tab" data-mtab="0" class="${!a ? "on" : ""}">${vig.length ? "Todos" : "Historial"}</button></div>`;
    if (!a) {
      const m = nivelDep();
      return {
        legend: `<b>Avisos vigentes</b>${[4, 3, 2].map(l => `<span><i style="background:${LVC(l)}"></i>Nivel ${l} · ${LVN[l]}</span>`).join("")}`,
        map: peru({ fill: d => m[norm(d.n)] ? LVC(m[norm(d.n)]) : null }),
        panel: panelCard("", tabs + (M.MAV.length ? `<div style="overflow-x:auto;margin-top:8px"><table class="tb"><thead><tr><th>Aviso</th><th>Nro</th><th>Emisión</th><th>Inicio</th><th>Fin</th><th class="num">Duración</th><th>Nivel</th></tr></thead><tbody>${M.MAV.map(x => `<tr ${x.vig ? `data-mtab="${x.num}"` : ""} class="${x.vig ? "" : "old"}"><td style="min-width:180px">${x.titulo.charAt(0) + x.titulo.slice(1).toLowerCase()}${x.vig ? "" : ` <span class="chip ghost">${x.cancelado ? "Cancelado" : "Vencido"}</span>`}</td><td>${x.num}</td><td>${x.emiC}</td><td>${x.iniC}</td><td>${x.finC}</td><td class="num">${fmt(x.dur)} h</td><td>${chipAv(x.nivel)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted" style="margin-top:12px">No hay avisos en el producto.</p>`))
      };
    }
    const day = Math.min(S.mavi.day, a.dias.length - 1), dd = a.dias[day] || { f: "", deps: [], t: "" }, set = new Set(dd.deps.map(norm));
    return {
      legend: `<b>Niveles de peligro</b>${[4, 3, 2].map(l => `<span><i style="background:${LVC(l)}"></i>Nivel ${l} · ${LVN[l]}</span>`).join("")}`,
      map: peru({ click: true, fill: d => set.has(norm(d.n)) ? LVC(a.nivel) : null, aria: `Mapa del aviso ${a.num}, ${dd.f}` }), hint: `${dd.f} · ${dd.deps.length} departamentos`,
      panel: panelCard("", tabs + `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-top:12px"><div><div class="eyebrow">Aviso N° ${a.num} · ${a.cod}</div><h3 style="margin:4px 0 0;font-size:15px">${a.titulo}</h3></div>${chipAv(a.nivel)}</div>
        <dl class="dl" style="margin-top:10px"><dt>Fecha de emisión</dt><dd>${a.emi}</dd><dt>Inicio del evento</dt><dd>${a.ini}</dd><dt>Fin del evento</dt><dd>${a.fin}</dd><dt>Vigencia</dt><dd>${fmt(a.dur)} horas</dd></dl>
        ${a.cuerpo ? `<p class="txt" style="margin-top:10px">${a.cuerpo}</p>` : ""}${docLink(a.doc)}`) +
        (a.dias.length ? panelCard(`<h3>Evolución por día</h3>`, `<div class="thumbs">${a.dias.map((x, i) => { const st = new Set(x.deps.map(norm)); return `<button class="thumb ${i === day ? "on" : ""}" data-mday2="${i}">${peru({ fill: d => st.has(norm(d.n)) ? LVC(a.nivel) : null, aria: x.f })}${x.f.split(" ").slice(0, 2).join(" ")}</button>`; }).join("")}</div>
        <p class="txt" style="margin-top:10px"><b>${dd.f}.</b> ${dd.t}</p>`) : "") +
        panelCard(`<h3>Departamentos de posible afectación (${dd.deps.length})</h3>`, `<div class="chips">${dd.deps.map(d => `<span class="chip ghost">${d}</span>`).join("")}</div>
        <div class="pr" style="margin-top:12px;--lc:${LVC(a.nivel)}"><div><b>Peligro</b>${a.peligro}</div><div><b>Recomendación</b>${a.recom}</div></div>`)
    };
  }
};
