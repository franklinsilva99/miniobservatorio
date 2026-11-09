# Consulta al equipo de meteorología: contrato de datos 1.1

El Portal de Contingencia actualizó su contrato de datos. **Los productos de meteorología que ya publican siguen siendo válidos sin cambios.** Necesitamos su respuesta sobre tres puntos.

## 1. Un manifiesto por sistema

Hoy todos los productos comparten `manifest.json`, que se lee, se modifica y se reescribe. Si meteorología e hidrología publican a la vez, una publicación puede borrar a la otra.

**Propuesta:** hidrología escribe solo en `hidro/manifest.json`, y meteorología sigue en `manifest.json` o pasa a `meteo/manifest.json`. Lo único que cambia es la configuración del portal. El portal ya admite ambas opciones.

**¿Están de acuerdo? ¿Prefieren mantener el manifiesto de la raíz o pasar al suyo?**

## 2. Elementos con errores

Antes, una sola estación o aviso mal armado hacía rechazar todo el archivo. Ahora se omite solo ese elemento y se indica cuántos faltan. El archivo se rechaza completo si está dañado o si tiene errores en más del 20 % de sus elementos.

**¿Les parece bien este límite?**

## 3. Frecuencia de consulta

Para soportar mucho tráfico, el portal consulta cada 5 minutos y no cada 60 segundos. Un producto nuevo puede tardar hasta unos 6 minutos en verse.

**¿Es aceptable para sus avisos y su monitoreo cada 10 minutos?**

El detalle está en `docs/contrato-datos.md`. Para comprobar sus archivos: `node tools/validar.mjs <carpeta>`.
