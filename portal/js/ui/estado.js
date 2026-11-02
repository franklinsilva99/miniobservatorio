/* Estado de la interfaz y catálogo de productos del mosaico. */
import { repo, salud } from "../datos/repositorio.js";
import { dmhm, relativo } from "./util.js";

export const PRODS = {
  "hidro-monitoreo": { dom: "hidro", type: "mon", name: "Monitoreo hidrológico", sub: "Estaciones y estado por umbral" },
  "hidro-pronostico": { dom: "hidro", type: "pro", name: "Pronóstico hidrológico", sub: "Caudal pronosticado por estación" },
  "hidro-avisos": { dom: "hidro", type: "avi", name: "Avisos hidrológicos", sub: "Avisos preventivos por avenida y vaciante" },
  "meteo-monitoreo": { dom: "meteo", type: "mon", name: "Monitoreo meteorológico", sub: "Registros de la red de estaciones" },
  "meteo-pronostico": { dom: "meteo", type: "pro", name: "Pronóstico meteorológico", sub: "Pronóstico por capital de departamento" },
  "meteo-avisos": { dom: "meteo", type: "avi", name: "Avisos meteorológicos", sub: "Avisos preventivos ante eventos severos" }
};
export const DOMV = { hidro: ["var(--hidro)", "var(--hidro-soft)", "Hidrología"], meteo: ["var(--meteo)", "var(--meteo-soft)", "Meteorología"] };

/** Selecciones del usuario (no se guardan: el portal es de solo lectura). */
export const S = {
  hmon: { sel: null, var: "Q", agg: "h" },
  hpro: { sel: null },
  havi: { sel: null, f: "todos" },
  mmon: { var: "T", sel: null },
  mpro: { day: null, cap: "Lima" },
  mavi: { tab: null, day: 0 },
  lay: { avm: true, avh: true, eh: true, em: false, pr: false }
};

/** Color del indicador según la salud del producto. */
export const SALUD_C = { ok: "var(--l1)", verificando: "var(--l0)", desactualizado: "var(--l3)", sin_conexion: "var(--l3)", rechazado: "var(--l4)", no_disponible: "var(--l0)", cargando: "var(--l0)" };

/** Texto de emisión de un producto: «Emitido 02/11 10:00 · hace 5 min». */
export function emision(k) {
  const P = repo.productos[k];
  if (!P.emitido) return salud(k).texto;
  return `<span>Emitido ${dmhm(P.emitido)} · <span data-rel="${P.emitido}">${relativo(P.emitido)}</span></span>`;
}
