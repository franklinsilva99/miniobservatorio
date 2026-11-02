# Portal de Contingencia · SENAMHI

**Sistema Informático para el apoyo a la Continuidad Operativa del SENAMHI**, Fase 1, Módulo 4: versión minimalista del Portal de Contingencia (monitoreo, pronósticos y avisos).

**Área usuaria:** Unidad de Comunicaciones · **Versión:** 1.0 · **Contrato de datos:** 1.0 · **Fecha:** noviembre de 2026

## Qué es

Es un canal alterno de difusión que muestra en **un solo mosaico** los seis productos hidrometeorológicos: monitoreo, pronóstico y avisos, tanto de meteorología como de hidrología. Cada tarjeta se amplía en la misma página con su mapa y su detalle.

El portal **no genera productos**. Los sistemas productores publican archivos JSON en un **repositorio de productos**, y el portal los **recibe, valida y muestra**. Si un sistema falla, el portal sigue mostrando la última versión válida e informa la incidencia.

```
Sistemas productores ──publican──▶ Repositorio (manifest.json + 6 JSON) ◀──lee cada 60 s── Portal
```

## Alcance de esta versión

| Incluido | No incluido (siguiente fase) |
|---|---|
| Frontend completo del mosaico y de las 6 vistas ampliadas | Integración real con los sistemas productores |
| Recepción de productos: manifiesto, validación, rechazo, copia local y estados | Logotipos oficiales y datos de contacto definitivos |
| Contrato de datos 1.0 con validador automático | Exportación de PNG y PDF desde el portal |
| Herramientas para publicar y validar (productores) | Despliegue en la infraestructura del SENAMHI |
| Repositorio de **demostración** con datos de ejemplo de las PoC | |

> Los productos de `productos/` son **datos de ejemplo** basados en las PoC `senamhi-hidrologia` y `senamhi-pronostico-dashboard`. El portal muestra la franja «Repositorio de demostración» mientras `manifest.json` tenga `"demo": true`.

## Requisitos

- **Para usar el portal:** un navegador actual (Edge, Chrome, Firefox o Safari de los últimos 2 años).
- **Para las herramientas y la demostración local:** [Node.js](https://nodejs.org) 18 o superior. **No se instalan dependencias** (no hay `npm install`).

## Ejecutar la demostración

```bash
cd portal
node tools/generar-ejemplos.mjs    # 1. fecha los productos de ejemplo a la hora actual
node tools/servidor.mjs 8731       # 2. levanta el portal en http://localhost:8731
```

Si el puerto está ocupado, se puede usar otro, por ejemplo `node tools/servidor.mjs 9000`.

> **Conviene ejecutar el paso 1 antes de cada demostración.** Si los productos tienen días de antigüedad, el portal los marcará como «desactualizados» y los avisos aparecerán vencidos. Así es como debe comportarse.

Para una demostración larga se puede usar `node tools/generar-ejemplos.mjs --continuo` en otra terminal. Vuelve a publicar cada 10 minutos, como los sistemas reales, y el portal muestra los datos nuevos en menos de 1 minuto.

El portal **no funciona abriendo `index.html` con doble clic** (`file://`), porque el navegador bloquea la lectura de los JSON. Hay que servirlo por HTTP.

### Cómo mostrar la resiliencia en la demostración

| Para mostrar… | Hacer… |
|---|---|
| Un producto rechazado | Editar `productos/meteo/avisos.json`, poner `"nivel": "roja"` en un aviso y cambiar su `emitido` (en el archivo y en `manifest.json`). |
| Un producto que no llegó | Renombrar `productos/hidro/pronostico.json` y cambiar su `emitido` en `manifest.json`. |
| Repositorio caído | Herramientas de desarrollo del navegador (F12) → Red → «Sin conexión» y esperar al siguiente ciclo, o recargar. |
| Restaurar | `node tools/generar-ejemplos.mjs` |

## Estructura

```
portal/
├── index.html                 Página única del mosaico
├── sw.js                      Service Worker: abre la aplicación sin conexión
├── css/portal.css             Estilos (tokens de la guía de UI, colores SENAMHI)
├── js/
│   ├── app.js                 Arranque, eventos y ciclo de actualización
│   ├── config.js              ← CONFIGURACIÓN DE DESPLIEGUE (URL del repositorio, intervalo)
│   ├── datos/contrato.js      Contrato de datos y validador (compartido con tools/)
│   ├── datos/repositorio.js   Recepción: manifiesto, descarga, rechazo, copia local, salud
│   ├── datos/modelo.js        Contrato → modelo de vista
│   ├── ui/mosaico.js          Tarjetas del mosaico
│   ├── ui/detalle.js          Vistas ampliadas
│   ├── ui/graficos.js         Mapa SVG, gráficos e indicador de nivel
│   ├── ui/estado.js           Estado de la interfaz
│   ├── ui/util.js             Formato SI, fechas (hora de Lima), iconos
│   └── geo/peru.js            Cartografía base (límites INEI)
├── productos/                 Repositorio de DEMOSTRACIÓN (manifest.json + 6 productos)
├── tools/                     Herramientas en Node, sin dependencias (no se despliegan)
│   ├── generar-ejemplos.mjs   Genera el repositorio de demostración
│   ├── publicar.mjs           Valida y publica un producto (referencia para productores)
│   ├── validar.mjs            Valida un repositorio completo
│   ├── lib-publicacion.mjs    Publicación atómica + manifiesto
│   ├── servidor.mjs           Servidor estático local
│   └── semilla/               Catálogo de estaciones de la PoC meteorológica
└── docs/
    ├── arquitectura.md        Decisión de arquitectura, flujos, estados y despliegue
    ├── arquitectura.svg       Diagrama (se puede insertar en el informe)
    └── contrato-datos.md      Especificación para los sistemas productores
```

## Configuración de despliegue (`js/config.js`)

| Clave | Por defecto | Descripción |
|---|---|---|
| `repositorio` | `"productos/"` | URL del repositorio. Si es otro dominio, ese servidor debe enviar la cabecera CORS. |
| `intervalo_s` | `60` | Frecuencia de consulta del manifiesto, en segundos. |
| `timeout_ms` | `10000` | Tiempo máximo de cada descarga. |
| `tolerancia` | `2` | Un producto está desactualizado si su antigüedad supera `frecuencia_min × tolerancia`. |
| `institucion.contacto` | por confirmar | Texto del pie de página. |

## Despliegue

1. Copiar `index.html`, `sw.js`, `css/` y `js/` a un servidor web estático (Nginx, Apache, IIS o un CDN). No requiere servidor de aplicación ni base de datos.
2. Publicar el repositorio de productos (mismo servidor u otro). Los productores deben seguir el procedimiento de `docs/contrato-datos.md` §4.
3. Servir `manifest.json` y los productos con `Cache-Control: no-cache`.
4. Por su función de contingencia, se recomienda alojar el portal y el repositorio **fuera de la infraestructura principal**.

## Para los sistemas productores

Hay que leer **[`docs/contrato-datos.md`](docs/contrato-datos.md)** y validar cada archivo antes de publicarlo:

```bash
node tools/publicar.mjs mi-producto.json --repo /ruta/del/repositorio
node tools/validar.mjs /ruta/del/repositorio
```

## Decisiones técnicas

- **Sin frameworks ni compilación:** pesa poco (la aplicación ocupa unos 150 KB y los seis productos, unos 105 KB), carga rápido con poco ancho de banda y no acumula dependencias que mantener.
- **Sin recursos externos:** usa la fuente del sistema, mapas y gráficos en SVG generados en el navegador, y no depende de ningún CDN.
- **Seguridad:** todo texto de los productos se escapa antes de mostrarse, y solo se aceptan enlaces `http` y `https`.
- **Formato peruano:** coma decimal, espacio como separador de miles y horas en hora de Lima (UTC−5).
- **Base visual:** wireframes y guía de UI del entregable (`../wireframes/`).
