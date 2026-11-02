# Contrato de datos 1.0: productos del Portal de Contingencia

Este documento define **qué archivos debe publicar cada sistema productor** para que el Portal de Contingencia los muestre. Es el único punto de acuerdo entre los sistemas: el portal no depende de su tecnología, base de datos ni API.

- **Validación automática:** el contrato está implementado en `js/datos/contrato.js`. El portal y las herramientas `tools/validar.mjs` y `tools/publicar.mjs` usan ese mismo archivo, así que **si un producto pasa el validador, el portal lo acepta**.
- **Ejemplos completos:** la carpeta `productos/` tiene los seis productos de demostración.

## 1. Reglas generales

| Regla | Detalle |
|---|---|
| Formato | JSON en UTF-8. Se tolera la marca BOM. |
| Fechas y horas | ISO 8601 **con zona horaria**: `2026-11-02T10:00:00-05:00` (o `...Z` en UTC). El portal muestra todo en hora de Lima. |
| Fechas sin hora | `AAAA-MM-DD` (por ejemplo, en pronósticos por día). |
| Coordenadas | `lat` y `lon` en grados decimales WGS84 (el Perú tiene latitud y longitud negativas). **No usar UTM.** |
| Niveles de peligro | `"moderada"`, `"fuerte"` o `"extrema"` (nomenclatura del Observatorio). |
| Umbrales | Lista de 3 valores en orden `[moderada, fuerte, extrema]`. En **avenida** son crecientes y en **vaciante**, decrecientes. |
| Valores faltantes | `null` (por ejemplo, un sensor que no transmitió). No usar `-999`, `""` ni `0`. |
| Textos | Texto plano, sin HTML. El portal escapa todo texto. |
| Autocontenido | Cada producto incluye todo lo que necesita para mostrarse (nombre, coordenadas y umbrales de sus estaciones). Si falta otro producto, este debe seguir funcionando. |

## 2. Estructura del repositorio

```
productos/
├── manifest.json            ← índice: qué productos hay y cuándo se emitieron
├── meteo/monitoreo.json
├── meteo/pronostico.json
├── meteo/avisos.json
├── hidro/monitoreo.json
├── hidro/pronostico.json
└── hidro/avisos.json
```

### 2.1 `manifest.json`

```json
{
  "contrato": "1.0",
  "generado": "2026-11-02T15:02:10Z",
  "demo": false,
  "productos": [
    { "id": "meteo-monitoreo", "url": "meteo/monitoreo.json", "emitido": "2026-11-02T15:00:00-05:00", "frecuencia_min": 10 }
  ]
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `contrato` | texto | sí | Versión del contrato. El portal acepta cualquier versión `1.x`. |
| `generado` | fecha-hora | sí | Momento en que se escribió el manifiesto. |
| `demo` | booleano | no | `true` muestra la franja «Repositorio de demostración». |
| `productos[].id` | texto | sí | Uno de los seis identificadores (ver sección 3). |
| `productos[].url` | texto | sí | Ruta del archivo, relativa al manifiesto. |
| `productos[].emitido` | fecha-hora | sí | Debe coincidir con el `emitido` del archivo. **El portal solo descarga un producto cuando este valor cambia.** |
| `productos[].frecuencia_min` | entero | sí | Cada cuántos minutos se espera una emisión nueva. Si la antigüedad supera el doble, el portal lo marca como «desactualizado». |

### 2.2 Sobre común de todos los productos

```json
{
  "contrato": "1.0",
  "producto": "hidro-avisos",
  "emitido": "2026-11-02T14:00:00-05:00",
  "fuente": "SENAMHI · Dirección de Hidrología (avisos hidrológicos)",
  "datos": { }
}
```

`producto` debe coincidir con el `id` del manifiesto. `fuente` se muestra al pie de la tarjeta. El contenido de `datos` depende del producto.

## 3. Contenido de `datos` por producto

Las referencias a «obligatorio: no» indican que el campo puede omitirse.

### 3.1 `meteo-monitoreo`: monitoreo meteorológico · frecuencia sugerida 10 min

```json
{ "estaciones": [ {
  "id": "47E3834A", "nombre": "Ema Imata", "departamento": "Arequipa", "provincia": "Caylloma",
  "altitud": 4475, "lat": -15.836, "lon": -71.087,
  "variables": ["T", "HR", "PP", "V"],
  "actual": { "fecha": "2026-11-02T15:00:00-05:00", "T": 8.4, "HR": 41, "PP": 0, "V": null },
  "serie":  { "inicio": "2026-10-30T16:00:00-05:00", "paso_min": 60, "T": [ ... ], "HR": [ ... ], "PP": [ ... ], "V": [ ... ] }
} ] }
```

| Campo | Obligatorio | Descripción |
|---|---|---|
| `variables` | sí | Variables que **registra** la estación: `T` temperatura (°C), `HR` humedad relativa (%), `PP` precipitación (mm/h), `V` viento (km/h). El portal solo muestra estas. |
| `actual.<var>` | sí, para cada variable declarada | Último valor, o `null` si no transmitió. |
| `serie` | no | Serie horaria. Se recomiendan 72 valores. Con 25 o más, el portal calcula la variación y la precipitación acumulada en 24 h. |

### 3.2 `meteo-pronostico`: pronóstico meteorológico · frecuencia sugerida 720 min

```json
{ "fechas": ["2026-11-02", "2026-11-03", "2026-11-04"],
  "ciudades": [ { "departamento": "Lima", "ciudad": "Lima",
    "dias": [ { "tmax": 21, "tmin": 16, "cielo": "cubierto", "descripcion": "Cielo cubierto variando a nublado parcial." } ] } ] }
```

- `dias` debe tener un elemento por cada fecha de `fechas`, en el mismo orden.
- `cielo` admite `despejado`, `nubes_dispersas`, `nublado_parcial`, `cubierto`, `lluvia_ligera`, `lluvia_moderada`, `tormenta` o `nevada`. El portal elige el icono a partir de este valor.
- `departamento` debe escribirse como en la cartografía INEI (por ejemplo, «Áncash» o «San Martín») para que se coloree el mapa.

### 3.3 `meteo-avisos`: avisos meteorológicos · frecuencia sugerida 1440 min

```json
{ "avisos": [ {
  "numero": 342, "codigo": "342-2026-SENAMHI/DMA", "nivel": "extrema", "estado": "emitido",
  "titulo": "INCREMENTO DE TEMPERATURA DIURNA EN LA COSTA Y SIERRA",
  "emitido": "2026-11-01T10:00:00-05:00", "inicio": "2026-11-02T00:00:00-05:00", "fin": "2026-11-04T23:59:00-05:00", "duracion_h": 72,
  "departamentos": ["Tumbes", "Piura"],
  "cuerpo": "El SENAMHI informa que…",
  "peligro": "Se predicen fenómenos meteorológicos de gran magnitud.",
  "recomendacion": "Sea extremadamente precavido…",
  "dias": [ { "fecha": "2026-11-02", "departamentos": ["Tumbes", "Piura"], "texto": "Se prevén temperaturas máximas…" } ],
  "documento": "avisos/342-2026.pdf"
} ] }
```

| Campo | Obligatorio | Descripción |
|---|---|---|
| `numero`, `nivel`, `titulo`, `emitido`, `inicio`, `fin`, `duracion_h` | sí | Datos básicos. |
| `estado` | no | `emitido` (por defecto) o `cancelado`. Un aviso cancelado deja de mostrarse como vigente. |
| `departamentos`, `cuerpo`, `dias` | no | Detalle. Si no se envía `dias`, el portal usa `departamentos` para todo el periodo. |
| `peligro`, `recomendacion` | no | Si se omiten, el portal muestra los textos genéricos del nivel. |
| `documento` | no | PDF oficial (ruta relativa al repositorio o URL `https`). Se muestra como botón de descarga. |

**Vigencia:** un aviso está vigente si no está cancelado y `fin` aún no ha pasado. Se recomienda incluir también los avisos recientes ya vencidos, porque el portal los muestra como historial.

### 3.4 `hidro-monitoreo`: monitoreo hidrológico · frecuencia sugerida 10 min

```json
{ "estaciones": [ {
  "id": "socsi", "nombre": "Socsi", "rio": "Cañete", "cuenca": "Cañete", "region_hidrografica": "Pacífico",
  "departamento": "Lima", "provincia": "Cañete", "distritos": ["Nuevo Imperial", "Cañete"], "centros_poblados": ["Cañete"],
  "lat": -13.03051, "lon": -76.20027, "tipo_umbral": "avenida",
  "umbrales": { "caudal": [42, 54, 69], "nivel": [1.95, 3.06, 4.42] },
  "actual": { "fecha": "2026-11-02T15:00:00-05:00", "caudal": 58.4, "nivel": 3.21 },
  "serie":  { "inicio": "2026-10-30T16:00:00-05:00", "paso_min": 60, "caudal": [ ... ], "nivel": [ ... ] }
} ] }
```

- `tipo_umbral`: con `avenida`, la alerta sube cuando el valor aumenta; con `vaciante`, cuando el valor baja.
- `actual.caudal: null` indica una estación sin datos (mantenimiento). Se muestra en gris.
- El estado (normal, moderada, fuerte o extrema) **lo calcula el portal** comparando `actual.caudal` con `umbrales.caudal`.

### 3.5 `hidro-pronostico`: pronóstico hidrológico · frecuencia sugerida 1440 min

```json
{ "estaciones": [ {
  "id": "socsi", "nombre": "Socsi", "rio": "Cañete", "departamento": "Lima", "lat": -13.03051, "lon": -76.20027,
  "tipo_umbral": "avenida", "umbrales_caudal": [42, 54, 69],
  "observado":  { "fechas": ["2026-10-28", "…", "2026-11-02"], "caudal": [44.1, "…", 57.6] },
  "pronostico": { "fechas": ["2026-11-03", "2026-11-04", "2026-11-05"],
                  "modelos": [ { "nombre": "Modelo 1", "caudal": [55.4, 53.2, 50.1] } ] }
} ] }
```

Cada modelo debe tener un valor por cada fecha de `pronostico.fechas`. El portal muestra el promedio de los modelos, la banda entre el mínimo y el máximo, y el estado según los umbrales.

### 3.6 `hidro-avisos`: avisos hidrológicos · frecuencia sugerida 1440 min

```json
{ "avisos": [ {
  "numero": 1613, "nivel": "fuerte", "tipo": "avenida", "plazo": "Extendido", "estado": "emitido",
  "emitido": "2026-11-02T14:00:00-05:00", "inicio": "2026-11-02T14:00:00-05:00", "fin": "2026-11-08T20:00:00-05:00", "duracion_h": 150,
  "titulo": "SITUACIÓN ACTUAL DEL CAUDAL DEL RÍO CAÑETE - ESTACIÓN SOCSI",
  "descripcion": "El SENAMHI, organismo adscrito al Ministerio del Ambiente, informa…",
  "peligro": "…", "recomendacion": "…",
  "variable": "caudal", "valor": 58.4, "unidad": "m³/s", "tendencia": "ascendente",
  "estacion": { "id": "socsi", "nombre": "Socsi", "rio": "Cañete", "departamento": "Lima", "provincia": "Cañete",
                "distritos": ["Nuevo Imperial"], "centros_poblados": ["Cañete"], "lat": -13.03051, "lon": -76.20027, "umbrales": [42, 54, 69] },
  "serie": { "inicio": "2026-10-30T22:00:00-05:00", "paso_min": 60, "valores": [ ... ] },
  "documento": "avisos/1613.pdf"
} ] }
```

`serie`, `peligro`, `recomendacion`, `plazo`, `tendencia`, `estado` y `documento` son opcionales.

## 4. Procedimiento de publicación (obligatorio)

Para que el portal **nunca lea un archivo a medio escribir**, cada emisión debe seguir este orden:

1. **Validar** el archivo: `node tools/validar.mjs` o `node tools/publicar.mjs` (este último valida antes de publicar).
2. **Escribir el producto** en un archivo temporal dentro de la misma carpeta y luego **renombrarlo** al nombre final. El renombrado es atómico.
3. **Actualizar `manifest.json` al final**, también con un archivo temporal y renombrado, cambiando el `emitido` del producto.

Con SFTP o rsync, se sube el archivo con un nombre temporal (`.tmp`) y se renombra en el servidor. Con una carpeta compartida, se aplica la misma regla.

Implementación de referencia: `tools/lib-publicacion.mjs`.

```bash
# Desde el sistema productor (requiere Node 18 o superior):
node tools/publicar.mjs salida/hidro-avisos.json --repo /ruta/al/repositorio
# ✔ hidro-avisos publicado en /ruta/al/repositorio/hidro/avisos.json (emitido 2026-11-02T14:00:00-05:00)

# Si el archivo no cumple el contrato, NO se publica y se explica el motivo:
# ✘ salida/hidro-avisos.json
#   · datos.avisos[0].nivel: valor «roja» no permitido (use: moderada, fuerte, extrema)
```

## 5. Comportamiento del portal ante errores del productor

| Situación | Resultado en el portal |
|---|---|
| El archivo no cumple el contrato | Se **rechaza**, se conserva la versión anterior y la tarjeta lo indica. |
| El archivo no existe (HTTP 404) | Se conserva la versión anterior y se informa la incidencia. |
| El repositorio no responde | Franja «Sin conexión» y última versión recibida; reintenta cada 60 s. |
| No llega una emisión a tiempo | Se marca «desactualizado» cuando supera `frecuencia_min × 2`. |
| Llega una emisión más antigua que la que ya se tiene | Se ignora. |

## 6. Versionado del contrato

- **1.x** (cambios menores): solo se agregan campos **opcionales**. Los productores y el portal siguen siendo compatibles.
- **2.0** (cambio mayor): se renombran o eliminan campos, o se vuelven obligatorios. El portal rechaza productos de otra versión mayor, así que hay que coordinar la actualización.
