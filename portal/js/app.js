/* =====================================================================
   Portal de Contingencia · arranque
   Flujo: copia local → render inmediato → consulta al repositorio →
          render con datos nuevos → nueva consulta cada CONFIG.intervalo_s
   ===================================================================== */
import { CONFIG } from "./config.js";
import { repo, iniciarRepositorio, actualizar, salud } from "./datos/repositorio.js";
import { M, construir } from "./datos/modelo.js";
import { BENTO, ORDEN } from "./ui/mosaico.js";
import { DET } from "./ui/detalle.js";
import { PRODS, DOMV, S, emision } from "./ui/estado.js";
import { $, ICON, hm, relojFecha, relativo, esc, norm } from "./ui/util.js";

/* ---------- render ---------- */
function renderTiles() {
  $("#bento").innerHTML = ORDEN.map(k => BENTO[k]()).join("");
  const n = M.HAV.filter(a => a.vig).length + M.MAV.filter(a => a.vig).length;
  const nav = $("#nav-av"); nav.hidden = !n; nav.textContent = `▲ ${n} aviso${n === 1 ? "" : "s"} vigente${n === 1 ? "" : "s"}`;
  nav.dataset.open = M.MAV.some(a => a.vig) ? "meteo-avisos" : "hidro-avisos";
  renderBanner(); tick();
}

function renderBanner() {
  const b = $("#banner"), demo = repo.manifiesto?.demo;
  const malos = Object.keys(PRODS).filter(k => !["ok", "cargando", "verificando"].includes(salud(k).nivel));
  let msg = "";
  const hayDatos = Object.values(repo.productos).some(p => p.json);
  if (repo.conexion === "sin_conexion") msg = `${ICON.off}<span><b>Sin conexión con el repositorio de productos.</b> ${hayDatos ? "Se muestra la última información recibida" : "Aún no se ha recibido ningún producto en este dispositivo"}; el portal reintentará cada ${CONFIG.intervalo_s} s.</span>`;
  else if (repo.conexion === "error") msg = `<span><b>El repositorio de productos respondió con un error.</b> ${esc(repo.errorManifiesto || "")}</span>`;
  else if (malos.length) msg = `<span><b>${malos.length} producto${malos.length > 1 ? "s" : ""} con incidencias:</b> ${malos.map(k => `${PRODS[k].name} (${esc(salud(k).texto.split(" · ")[0].toLowerCase())})`).join(", ")}.</span>`;
  b.innerHTML = msg ? `<div class="container">${msg}</div>` : ""; b.hidden = !msg;
  $("#demo").hidden = !demo;
}

let current = null, opener = null;
function renderDlg() {
  const k = current, p = PRODS[k], [acc, soft, dn] = DOMV[p.dom], d = DET[k](), dlg = $("#dlg");
  dlg.style.setProperty("--acc", acc); dlg.style.setProperty("--acc-soft", soft);
  dlg.innerHTML = `<div class="d-h"><div class="container"><div class="ic">${ICON[p.type]}</div><div><div class="eyebrow">${dn} · ${emision(k)}</div><h2 id="dlg-t">${p.name}</h2><p>${p.sub} · Fuente: ${M.fuente[k]}</p></div>
    <div class="acts">${d.tools || ""}<button class="btn" data-act="share">🔗 Compartir</button><button class="btn" data-act="print">🖨 Imprimir</button><button class="close" data-close aria-label="Cerrar y volver al mosaico" autofocus>✕</button></div></div></div>
    <div class="container d-b"><div class="d-map">${d.map}${d.legend ? `<div class="legend">${d.legend}</div>` : ""}<div class="hint">${d.hint || "Toca un punto para ver su detalle"}</div></div><div class="panel">${d.panel}</div></div>`;
  tick();
}
function openDlg(k, push = true) {
  if (!PRODS[k] || !M.ok[k]) return;
  current = k; opener = opener || document.activeElement; renderDlg();
  const dlg = $("#dlg"); if (!dlg.open) dlg.showModal(); dlg.scrollTop = 0;
  if (push && location.hash !== "#/" + k) history.pushState(null, "", "#/" + k);
  document.title = PRODS[k].name + " · Portal de Contingencia";
}
function closeDlg() { const dlg = $("#dlg"); if (dlg.open) dlg.close(); }
$("#dlg").addEventListener("close", () => {
  current = null; document.title = "Portal de Contingencia · SENAMHI";
  if (location.hash.startsWith("#/") && location.hash.length > 2) history.pushState(null, "", "#/");
  const t = opener && document.body.contains(opener) ? opener : null; opener = null; renderTiles();
  (t || document.querySelector("[data-open]"))?.focus?.();
});
const rerender = () => current ? renderDlg() : renderTiles();

/* Textos relativos («hace 5 min») y reloj: se actualizan sin redibujar */
function tick() {
  const now = new Date();
  $("#clock").innerHTML = `<b>${hm(now)}</b><span>${relojFecha(now)}</span>`;
  document.querySelectorAll("[data-rel]").forEach(el => el.textContent = relativo(el.dataset.rel));
}

/* ---------- eventos ---------- */
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 1800); }
document.addEventListener("click", e => {
  if (e.target.closest("select")) return;
  const el = e.target.closest("[data-mvar],[data-mday],[data-lay],[data-open],[data-go],[data-close],[data-act],[data-hvar],[data-hagg],[data-sel],[data-hf],[data-av],[data-evar],[data-cap],[data-mtab],[data-mday2],.pt,.dep.click,.tile");
  if (!el || el.disabled) return;
  const inDlg = !!el.closest("#dlg"), ds = el.dataset;
  const rer = () => inDlg ? renderDlg() : renderTiles();
  if (ds.mvar) { S.mmon.var = ds.mvar; return rer(); }
  if (ds.mday) { S.mpro.day = +ds.mday; return rer(); }
  if (ds.lay) { const L = S.lay; L[ds.lay] = !L[ds.lay]; if (L[ds.lay] && ds.lay === "pr") L.avm = false; if (L[ds.lay] && ds.lay === "avm") L.pr = false; return renderTiles(); }
  if (ds.go) { document.getElementById(ds.go).scrollIntoView(); return; }
  // mapa central: cada elemento abre el producto que lo origina
  if (!inDlg && el.closest(".bigmap") && (el.classList.contains("pt") || el.classList.contains("dep"))) {
    if (ds.k === "eh") { S.hmon.sel = ds.id; return openDlg("hidro-monitoreo"); }
    if (ds.k === "ah") { S.havi.sel = +ds.id; S.havi.f = "todos"; return openDlg("hidro-avisos"); }
    if (ds.k === "em") { S.mmon.sel = ds.id; return openDlg("meteo-monitoreo"); }
    if (ds.dep) {
      const av = M.MAV.find(a => a.vig && a.deps.some(d => norm(d) === norm(ds.dep)));
      if (S.lay.avm && av) { S.mavi.tab = av.num; S.mavi.day = M.diaHoyAv(av); return openDlg("meteo-avisos"); }
      if (S.lay.pr && M.CAP(ds.dep)) { S.mpro.cap = M.CAP(ds.dep).cap; return openDlg("meteo-pronostico"); }
    }
    return;
  }
  if (ds.close != null) return closeDlg();
  if (ds.act) {
    if (ds.act === "share") navigator.clipboard?.writeText(location.href).then(() => toast("Enlace copiado"), () => toast(location.href));
    if (ds.act === "print") window.print();
    return;
  }
  if (ds.hvar) { S.hmon.var = ds.hvar; return renderDlg(); }
  if (ds.hagg) { S.hmon.agg = ds.hagg; return renderDlg(); }
  if (ds.hf) { S.havi.f = ds.hf; return renderDlg(); }
  if (ds.av) { S.havi.sel = +ds.av; return renderDlg(); }
  if (ds.evar) { S.mmon.var = ds.evar; return renderDlg(); }
  if (ds.mtab) { S.mavi.tab = +ds.mtab; const a = M.MAV.find(x => x.num === +ds.mtab); S.mavi.day = a ? M.diaHoyAv(a) : 0; return renderDlg(); }
  if (ds.mday2) { S.mavi.day = +ds.mday2; return renderDlg(); }
  if (ds.cap && el.tagName === "TR") { S.mpro.cap = ds.cap; return renderDlg(); }
  if (ds.sel || el.classList.contains("pt")) {
    const id = ds.sel || ds.id; if (!inDlg) { openFromTile(el); return; }
    if (current === "hidro-monitoreo") S.hmon.sel = id;
    else if (current === "hidro-pronostico") { if (!M.HFC[id]) return toast("Esta estación no tiene pronóstico en la emisión actual"); S.hpro.sel = id; }
    else if (current === "hidro-avisos") S.havi.sel = +id;
    else if (current === "meteo-monitoreo") { const st = M.EST.find(x => x.id === id); S.mmon.sel = id; if (st && !st.v.includes(S.mmon.var)) S.mmon.var = st.v[0]; }
    return renderDlg();
  }
  if (el.classList.contains("dep") && inDlg) { const c = M.CAP(ds.dep); if (current === "meteo-pronostico" && c) { S.mpro.cap = c.cap; renderDlg(); } return; }
  if (ds.open) { opener = el; return openDlg(ds.open); }
  if (el.classList.contains("tile") && !el.classList.contains("na")) openFromTile(el);
});
function openFromTile(el) { const t = el.closest(".tile"); if (t && !t.classList.contains("na") && t.dataset.k) { opener = t.querySelector("[data-open]"); openDlg(t.dataset.k); } }
document.addEventListener("change", e => {
  const t = e.target;
  if (t.matches("select[data-cap]")) { S.mpro.cap = t.value; renderDlg(); }
  if (t.matches("select[data-est]")) { S.mmon.sel = t.value; renderTiles(); }
  if (t.matches("select[data-capt]")) { S.mpro.cap = t.value; renderTiles(); }
});
window.addEventListener("popstate", route);
function route() { const k = location.hash.replace(/^#\//, ""); if (PRODS[k] && M.ok[k]) openDlg(k, false); else closeDlg(); }

$("#theme").onclick = () => {
  const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
  r.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("pc-theme", r.dataset.theme); } catch { }
};
try { const t = localStorage.getItem("pc-theme"); if (t) document.documentElement.dataset.theme = t; } catch { }
$("#contacto").textContent = CONFIG.institucion.contacto;

/* ---------- ciclo de actualización ---------- */
let enCurso = false;
async function ciclo() {
  if (enCurso) return; enCurso = true;
  try {
    const cambio = await actualizar();
    if (cambio) { construir(); rerender(); if (!current) route(); }
    else renderBanner();
  } finally { enCurso = false; }
}

iniciarRepositorio();      // 1. copia local (instantáneo, funciona sin red)
construir(); renderTiles();
await ciclo();             // 2. repositorio
route();
setInterval(ciclo, CONFIG.intervalo_s * 1000);
setInterval(tick, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) ciclo(); });
window.addEventListener("online", ciclo);
/* Reconstruye la vigencia de avisos y la antigüedad aunque no lleguen productos nuevos */
setInterval(() => { construir(); if (!current) renderTiles(); }, 5 * 60000);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => { });
