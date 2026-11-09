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

  /* Manifiestos a consultar, relativos al repositorio. Cada sistema productor
     publica el suyo para no pisar al otro. Por ahora solo publica hidrología;
     cuando meteorología publique, se agrega el suyo, por ejemplo:
     ["hidro/manifest.json", "meteo/manifest.json"]. Si dos declaran el mismo
     producto, manda el primero de la lista. */
  manifiestos: ["hidro/manifest.json"],

  /* Cada cuántos segundos se consultan los manifiestos. A 300 s un dato aparece
     hasta unos 6 min después de publicado (sumando dispersion_s), y las visitas
     simultáneas no consultan todas en el mismo minuto. */
  intervalo_s: 300,

  /* Espera máxima al azar antes de descargar una emisión nueva, para repartir el
     pico de descargas. La primera carga de la página no espera. */
  dispersion_s: 60,

  /* Tiempo máximo de espera de cada descarga (ms). */
  timeout_ms: 10000,

  /* Una estación cuyo último dato tiene más de estas horas se muestra como
     «sin datos recientes», salvo que tenga un aviso activo. */
  horas_sin_datos: 24,

  /* Un producto se marca «desactualizado» cuando su antigüedad supera
     frecuencia_min (declarada en el manifiesto) × tolerancia. */
  tolerancia: 2,

  /* Datos institucionales del pie de página (completar con los oficiales). */
  institucion: {
    nombre: "Servicio Nacional de Meteorología e Hidrología del Perú",
    contacto: "Central telefónica y correo: por confirmar con la Unidad de Comunicaciones"
  }
};
