/* =====================================================================
   Configuración del Portal de Contingencia
   Se edita al desplegar; no requiere recompilar nada.
   ===================================================================== */
export const CONFIG = {
  /* URL base del REPOSITORIO DE PRODUCTOS (donde los sistemas productores
     publican manifest.json y los archivos de cada producto).
     · Ruta relativa ("productos/") → mismo servidor que el portal.
     · URL absoluta ("https://productos.senamhi.gob.pe/contingencia/") →
       servidor aparte; ese servidor debe enviar la cabecera CORS
       Access-Control-Allow-Origin con el dominio del portal. */
  repositorio: "productos/",

  /* Cada cuántos segundos se consulta el manifiesto en busca de productos nuevos.
     Con monitoreo cada 10 min, 60 s garantiza que un dato aparezca como máximo
     1 minuto después de publicado (el manifiesto pesa < 1 KB). */
  intervalo_s: 60,

  /* Tiempo máximo de espera de cada descarga (ms). */
  timeout_ms: 10000,

  /* Un producto se marca «desactualizado» cuando su antigüedad supera
     frecuencia_min (declarada en el manifiesto) × tolerancia. */
  tolerancia: 2,

  /* Datos institucionales del pie de página (completar con los oficiales). */
  institucion: {
    nombre: "Servicio Nacional de Meteorología e Hidrología del Perú",
    contacto: "Central telefónica y correo: por confirmar con la Unidad de Comunicaciones"
  }
};
