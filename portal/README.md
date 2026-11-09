# Portal de Contingencia · SENAMHI

**Sistema Informático para el apoyo a la Continuidad Operativa del SENAMHI**, Fase 1, Módulo 4: versión minimalista del Portal de Contingencia (monitoreo, pronósticos y avisos).

**Área usuaria:** Unidad de Comunicaciones · **Versión:** 1.1 · **Contrato de datos:** 1.1 · **Fecha:** noviembre de 2026

## Qué es

Es un canal alterno de difusión que muestra en **un solo mosaico** los seis productos hidrometeorológicos: monitoreo, pronóstico y avisos, tanto de meteorología como de hidrología. Cada tarjeta se amplía en la misma página con su mapa y su detalle.

El portal **no genera productos**. Los sistemas productores publican archivos JSON en un **repositorio de productos**, y el portal los **recibe, valida y muestra**. Si un sistema falla, el portal sigue mostrando la última versión válida e informa la incidencia.

```
Sistemas productores ──publican──▶ Repositorio (manifiestos + 6 JSON) ◀──lee cada 5 min── Portal
```

## Alcance de esta versión

| Incluido | No incluido (siguiente fase) |
|---|---|
| Frontend completo del mosaico y de las 6 vistas ampliadas | Integración real con los sistemas productores |
| Recepción de productos: manifiesto, validación, rechazo, copia local y estados | Logotipos oficiales y datos de contacto definitivos |
| Contrato de datos 1.1 con validador automático | Exportación de PNG y PDF desde el portal |
| Herramientas para publicar y validar (productores) | Despliegue en la infraestructura del SENAMHI |
| Publicación real de hidrología (backend de `senamhi-hidrologia`) | Publicación de meteorología |

> Por ahora solo publica **hidrología**: su backend escribe en `productos/hidro/`. Las tarjetas de meteorología se muestran como «no disponible» hasta que su sistema publique. La carpeta `productos/` no se sube a git porque tiene datos reales.

## Requisitos

- **Para usar el portal:** un navegador actual (Edge, Chrome, Firefox o Safari de los últimos 2 años).
- **Para las herramientas y la prueba local:** [Node.js](https://nodejs.org) 18 o superior. **No se instalan dependencias** (no hay `npm install`).

## Ver el portal en local

1. Arrancar el backend de hidrología con la publicación encendida y apuntando a la carpeta `productos/` de este portal:
   `--hidrologia.portal.programado=true --hidrologia.portal.demo=false --hidrologia.portal.carpeta=<ruta>/portal/productos`.
   Publica un minuto después de cada corrida del control de calidad (cada 5 minutos).
2. Levantar el portal:

```bash
cd portal
node tools/servidor.mjs 8731       # http://localhost:8731
```

Si el puerto está ocupado, se puede usar otro, por ejemplo `node tools/servidor.mjs 9000`. Para comprobar lo publicado: `node tools/validar.mjs productos`.

Las pruebas automáticas se ejecutan con `node --test "tools/pruebas/*.test.mjs"` (Node 22 o superior).

El portal **no funciona abriendo `index.html` con doble clic** (`file://`), porque el navegador bloquea la lectura de los JSON. Hay que servirlo por HTTP.

### Cómo comprobar la resiliencia

| Para comprobar… | Hacer… |
|---|---|
| Un producto que no llegó | Renombrar `productos/hidro/avisos.json` y esperar al siguiente ciclo del portal. |
| Repositorio caído | Herramientas de desarrollo del navegador (F12) → Red → «Sin conexión» y esperar al siguiente ciclo, o recargar. |
| Restaurar | Borrar `productos/hidro/`: el backend vuelve a publicar todo en su siguiente corrida. |

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
├── productos/                 Repositorio de productos: lo llenan los productores (no se sube a git)
├── tools/                     Herramientas en Node, sin dependencias (no se despliegan)
│   ├── publicar.mjs           Valida y publica un producto (referencia para productores)
│   ├── validar.mjs            Valida un repositorio completo
│   ├── lib-publicacion.mjs    Publicación atómica + manifiesto
│   ├── servidor.mjs           Servidor estático local
│   └── pruebas/               Pruebas automáticas
└── docs/
    ├── arquitectura.md        Decisión de arquitectura, flujos, estados y despliegue
    ├── arquitectura.svg       Diagrama (se puede insertar en el informe)
    └── contrato-datos.md      Especificación para los sistemas productores
```

## Configuración de despliegue (`js/config.js`)

| Clave | Por defecto | Descripción |
|---|---|---|
| `repositorio` | `"productos/"` | URL del repositorio. Si es otro dominio, ese servidor debe enviar la cabecera CORS. |
| `manifiestos` | `["hidro/manifest.json"]` | Manifiestos a consultar, relativos al repositorio. Cada sistema productor tiene el suyo; por ahora solo hidrología. |
| `intervalo_s` | `300` | Frecuencia de consulta de los manifiestos, en segundos. |
| `dispersion_s` | `60` | Espera máxima al azar antes de bajar una emisión nueva. La primera carga no espera. |
| `horas_sin_datos` | `24` | A partir de estas horas, una estación sin aviso activo se muestra como «sin datos recientes». |
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
