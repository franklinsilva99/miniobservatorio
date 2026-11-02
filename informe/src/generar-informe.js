// Genera el Informe Técnico del Portal de Contingencia (Word .docx) con docx-js.
// Uso: cd informe/src && npm install && node generar-informe.js
// Las imágenes se toman de informe/img/. El índice se actualiza al abrir el documento en Word (F9).
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, Header, Footer, PageNumber, TableOfContents,
  LevelFormat, PageBreak, VerticalAlign
} = require("docx");

const RAIZ = path.resolve(__dirname, "..", ".."); // raíz del repositorio
const IMG = path.join(RAIZ, "informe", "img");
const SALIDA = path.join(RAIZ, "informe", "Informe-Tecnico-Portal-Contingencia.docx");

const C = { marino: "002259", azul: "0047BA", sol: "FFC600", texto: "14212F", gris: "5B6B7D", borde: "C9D3E0", suave: "F3F6FA", hidro: "0E7C86" };
const FONT = "Calibri";
const ANCHO = 9070; // A4 (11906) − márgenes 2 × 1418

/* ---------------- utilidades ---------------- */
function runs(texto, o = {}) {
  return String(texto).split(/(\*\*.+?\*\*|`.+?`)/g).filter(Boolean).map(t => {
    if (t.startsWith("**")) return new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, size: o.size, color: o.color });
    if (t.startsWith("`")) return new TextRun({ text: t.slice(1, -1), font: "Consolas", size: (o.size || 22) - 2, color: o.color || C.marino });
    return new TextRun({ text: t, font: FONT, size: o.size, color: o.color, italics: o.italics, bold: o.bold });
  });
}
const P = (t, o = {}) => new Paragraph({ children: runs(t, o), spacing: { after: 120, line: 276 }, alignment: o.align || AlignmentType.JUSTIFIED, keepNext: o.keepNext });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })], pageBreakBefore: true });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONT })], keepNext: true });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, font: FONT })], keepNext: true });
const B = (items, ref = "vinetas", instance) => items.map(t => new Paragraph({ numbering: { reference: ref, level: 0, ...(instance ? { instance } : {}) }, children: runs(t), spacing: { after: 60, line: 264 } }));
let nLista = 0;
const N = (items) => B(items, "numeros", ++nLista); // cada lista numerada reinicia en 1
const nota = (t) => new Paragraph({
  children: runs(t), spacing: { before: 120, after: 160, line: 264 },
  shading: { type: ShadingType.CLEAR, color: "auto", fill: "FFF8DB" },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: C.sol, space: 8 } }, indent: { left: 160, right: 160 }
});
const codigo = (lineas) => lineas.map((l, i) => new Paragraph({
  children: [new TextRun({ text: l || " ", font: "Consolas", size: 17, color: C.texto })],
  shading: { type: ShadingType.CLEAR, color: "auto", fill: C.suave }, spacing: { after: 0, before: i === 0 ? 80 : 0, line: 240 },
  indent: { left: 160, right: 160 }, keepLines: true, keepNext: i < lineas.length - 1
})).concat([new Paragraph({ children: [], spacing: { after: 80 } })]);

function tabla(head, filas, anchos) {
  const total = anchos.reduce((a, b) => a + b, 0);
  if (total !== ANCHO) anchos = anchos.map(w => Math.round(w * ANCHO / total));
  anchos[anchos.length - 1] += ANCHO - anchos.reduce((a, b) => a + b, 0);
  const borde = { style: BorderStyle.SINGLE, size: 4, color: C.borde };
  const borders = { top: borde, bottom: borde, left: borde, right: borde };
  const celda = (txt, i, cab, par) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER,
    shading: cab ? { type: ShadingType.CLEAR, color: "auto", fill: C.marino } : par ? { type: ShadingType.CLEAR, color: "auto", fill: C.suave } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (Array.isArray(txt) ? txt : [txt]).map(t => new Paragraph({ children: runs(t, { size: 19, color: cab ? "FFFFFF" : C.texto, bold: cab }), spacing: { after: 20, line: 252 } }))
  });
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: anchos,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => celda(h, i, true)) }),
      ...filas.map((f, k) => new TableRow({ cantSplit: true, children: f.map((c, i) => celda(c, i, false, k % 2 === 1)) }))]
  });
}
const esp = () => new Paragraph({ children: [], spacing: { after: 120 } });

let nFig = 0, nTab = 0;
function tamPNG(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function figura(archivo, pie, anchoPx = 605) {
  const f = path.join(IMG, archivo + ".png"), [w, h] = tamPNG(f);
  const alto = Math.round(anchoPx * h / w);
  nFig++;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(f), transformation: { width: anchoPx, height: alto }, altText: { title: pie, description: pie, name: archivo } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Figura ${nFig}. `, bold: true, size: 18, color: C.gris, font: FONT }), new TextRun({ text: pie, italics: true, size: 18, color: C.gris, font: FONT })] })
  ];
}
function T(titulo, head, filas, anchos) {
  nTab++;
  return [new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 }, children: [new TextRun({ text: `Tabla ${nTab}. `, bold: true, size: 18, color: C.gris, font: FONT }), new TextRun({ text: titulo, italics: true, size: 18, color: C.gris, font: FONT })] }), tabla(head, filas, anchos), esp()];
}

/* ---------------- carátula ---------------- */
const linea = (color, size = 18) => new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } }, spacing: { after: 240 } });
const caratula = [
  new Paragraph({ children: [new TextRun({ text: "SERVICIO NACIONAL DE METEOROLOGÍA E HIDROLOGÍA DEL PERÚ · SENAMHI", font: FONT, size: 20, bold: true, color: C.gris })], spacing: { before: 1200, after: 120 } }),
  linea(C.sol, 24),
  new Paragraph({ children: [new TextRun({ text: "Informe técnico de Análisis y Diseño", font: FONT, size: 30, color: C.azul })], spacing: { after: 120 } }),
  new Paragraph({ children: [new TextRun({ text: "Portal de Contingencia", font: FONT, size: 64, bold: true, color: C.marino })], spacing: { after: 120 } }),
  new Paragraph({ children: [new TextRun({ text: "Versión minimalista: monitoreo, pronósticos y avisos hidrológicos y meteorológicos", font: FONT, size: 26, color: C.texto })], spacing: { after: 1000 } }),
  tabla(["Dato", "Detalle"], [
    ["Proyecto", "Sistema Informático para el apoyo a la Continuidad Operativa del SENAMHI · Fase 1 · Módulo 4"],
    ["Entregable", "Entregable 5 · Informe técnico final de Análisis y Diseño"],
    ["Área usuaria", "Unidad de Comunicaciones"],
    ["Consultor responsable", "Franklin Miguel Silva Maguiña (Especialista)"],
    ["Periodo", "08/10/2026 al 06/11/2026"],
    ["Versión del documento", "1.0 · noviembre de 2026"]
  ], [2600, 6470]),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ children: [new TextRun({ text: "Control de versiones", font: FONT, size: 28, bold: true, color: C.marino })], spacing: { after: 160 } }),
  tabla(["Versión", "Fecha", "Descripción", "Autor"], [["1.0", "02/11/2026", "Versión inicial para la conformidad del Entregable 5", "F. Silva"]], [1100, 1500, 4870, 1600]),
  esp(),
  new Paragraph({ children: [new TextRun({ text: "Índice", font: FONT, size: 28, bold: true, color: C.marino })], spacing: { before: 240, after: 160 } }),
  new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-2" }),
];

/* ---------------- contenido ---------------- */
const s1 = [
  H1("1. Resumen ejecutivo"),
  P("Este informe documenta el análisis y diseño de la **versión minimalista del Portal de Contingencia** del SENAMHI. Es un canal alterno de difusión que muestra, en una sola página tipo mosaico, los seis productos hidrometeorológicos: monitoreo, pronóstico y avisos, tanto de meteorología como de hidrología."),
  P("El portal replica el esquema de trabajo de la sede central, donde varios sistemas generan productos y un portal los muestra, pero está diseñado para **seguir funcionando cuando la infraestructura principal no está disponible**. Por eso el portal **no genera ni consulta en línea** a los sistemas centrales: cada sistema productor **publica sus productos como archivos** en un repositorio independiente, y el portal los **recibe, valida y muestra**."),
  P("Como resultado del entregable, se elaboraron los wireframes, la guía de UI, el **frontend funcional** del portal con el mecanismo de recepción de productos, el **contrato de datos 1.0** con su validador automático, las herramientas de publicación para los productores y la documentación técnica."),
  ...T("Principales características de la solución", ["Aspecto", "Resultado"], [
    ["Productos integrados", "6 (monitoreo, pronóstico y avisos × meteorología e hidrología)"],
    ["Arquitectura", "Publicación de archivos estáticos (JSON) + frontend estático"],
    ["Actualidad de los datos", "Monitoreo cada 10 min; el portal detecta lo publicado en 60 s como máximo"],
    ["Base de datos", "**No requerida** para el portal"],
    ["Tecnología", "HTML, CSS y JavaScript estándar, sin frameworks ni compilación"],
    ["Peso", "≈ 150 KB de aplicación + ≈ 105 KB de los seis productos"],
    ["Infraestructura", "Un servidor web estático (Nginx o IIS) fuera de la infraestructura principal"],
    ["Resiliencia", "Validación de cada archivo, copia local de la última versión válida y estados visibles"]
  ], [2600, 6470]),
  nota("**Conclusión principal:** el portal de contingencia no necesita base de datos ni servidor de aplicación. Basta con un servidor web estático y con que los sistemas productores publiquen sus archivos según el contrato de datos. Esto minimiza los puntos de falla, el costo de operación y el tiempo de puesta en marcha.")
];

const s2 = [
  H1("2. Antecedentes y objetivos"),
  H2("2.1 Antecedentes"),
  P("En la sede central del SENAMHI, varios sistemas especializados (redes de estaciones, modelos de pronóstico y emisión de avisos) generan productos que se difunden a la ciudadanía a través de un portal institucional. Ante una contingencia (falla de la infraestructura principal, de la red o de los servidores centrales), la difusión de información crítica, como los **avisos de peligro**, no puede interrumpirse."),
  P("El **Sistema Informático para el apoyo a la Continuidad Operativa** contempla un **Portal de Contingencia**: un canal alterno que replica ese esquema (muchos sistemas → un portal) en una versión mínima, liviana y resistente a fallas."),
  H2("2.2 Objetivo general"),
  P("Analizar y diseñar la versión minimalista del Portal de Contingencia, que muestre los productos de monitoreo, pronóstico y avisos hidrometeorológicos con la mayor actualidad posible y que siga operando ante la indisponibilidad de los sistemas centrales."),
  H2("2.3 Objetivos específicos"),
  ...B(["Priorizar los elementos esenciales y reducir la sobrecarga visual y técnica (criterio minimalista).",
    "Definir la arquitectura y el mecanismo de recepción de productos desde los sistemas productores.",
    "Definir un contrato de datos común e independiente de la tecnología de cada sistema.",
    "Diseñar la interfaz (wireframes, prototipo navegable y guía de UI) con la identidad del SENAMHI y criterios de accesibilidad.",
    "Construir el frontend funcional y validar su comportamiento ante fallas.",
    "Identificar las tecnologías, la infraestructura y los recursos necesarios para su puesta en producción."]),
  H2("2.4 Alcance"),
  ...T("Alcance del entregable", ["Incluido en esta fase", "Fuera del alcance (siguiente fase)"], [
    ["Mosaico con los 6 productos y sus vistas ampliadas", "Integración real con los sistemas productores"],
    ["Mecanismo de recepción: manifiesto, validación, rechazo, copia local y estados", "Despliegue en la infraestructura del SENAMHI"],
    ["Contrato de datos 1.0 con validador automático", "Logotipos oficiales y datos de contacto definitivos"],
    ["Herramientas de publicación y validación para productores", "Exportación de imágenes y PDF desde el portal"],
    ["Repositorio de demostración con datos de ejemplo de las PoC", "Histórico, gestión de contenidos y estadísticas"]
  ], [4535, 4535])
];

const s3 = [
  H1("3. Levantamiento y requerimientos"),
  P("El levantamiento se realizó con la Unidad de Comunicaciones (14/10 al 19/10/2026). Se identificaron los canales prioritarios de difusión, se analizaron los flujos de contingencia comunicacional y los tiempos de respuesta, y se revisaron la identidad visual institucional y las normas de accesibilidad digital (WCAG 2.1)."),
  H2("3.1 Requerimientos funcionales"),
  ...T("Requerimientos funcionales", ["Código", "Requerimiento"], [
    ["RF-01", "Mostrar en una sola página (mosaico) los 6 productos: monitoreo, pronóstico y avisos de meteorología e hidrología."],
    ["RF-02", "Ampliar cualquier producto en la misma página, con su mapa y su detalle, sin perder el contexto del mosaico."],
    ["RF-03", "Mostrar un mapa nacional con capas activables: avisos meteorológicos, avisos hidrológicos, estaciones y pronóstico."],
    ["RF-04", "Indicar el nivel de peligro de cada aviso con la nomenclatura del Observatorio (Moderada, Fuerte, Extrema)."],
    ["RF-05", "Mostrar en monitoreo meteorológico solo las variables que registra cada estación (T, HR, PP, viento)."],
    ["RF-06", "Mostrar los hidrogramas con umbrales y el pronóstico de caudal por modelo."],
    ["RF-07", "Indicar la fecha de emisión, la fuente y el estado de actualización de cada producto."],
    ["RF-08", "Mostrar el número de avisos vigentes y dar acceso directo a ellos."],
    ["RF-09", "Permitir enlaces directos a cada producto (para compartir) e impresión."],
    ["RF-10", "Recibir los productos desde los sistemas productores sin depender de su disponibilidad en línea."]
  ], [1200, 7870]),
  H2("3.2 Requerimientos no funcionales"),
  ...T("Requerimientos no funcionales", ["Código", "Atributo", "Criterio"], [
    ["RNF-01", "Resiliencia", "Seguir mostrando la última información válida si cae un sistema productor o el repositorio."],
    ["RNF-02", "Actualidad", "Un producto publicado debe verse en el portal en 1 minuto como máximo; monitoreo cada 10 min."],
    ["RNF-03", "Bajo ancho de banda", "Carga total menor a 300 KB; sin fuentes, librerías ni CDN externos."],
    ["RNF-04", "Alta concurrencia", "Servir archivos estáticos que admitan caché y CDN, sin procesamiento por visita."],
    ["RNF-05", "Accesibilidad", "WCAG 2.1: contraste, navegación por teclado, foco visible, nivel siempre con texto además del color."],
    ["RNF-06", "Identidad visual", "Colores del SENAMHI (azul #0047BA, marino #002259, sol #FFC600)."],
    ["RNF-07", "Adaptabilidad", "Funcionar en computadora, tableta y celular; modo claro y oscuro."],
    ["RNF-08", "Seguridad", "Validar todo dato recibido y escapar todo texto antes de mostrarlo."],
    ["RNF-09", "Mantenibilidad", "Sin dependencias que actualizar; código modular y documentado."],
    ["RNF-10", "Formato local", "Coma decimal, espacio de miles y hora de Lima (UTC−5)."]
  ], [1200, 2000, 5870])
];

const s4 = [
  H1("4. Análisis de la situación actual"),
  P("Se revisaron las vistas públicas de las dos pruebas de concepto (PoC) disponibles, que son las fuentes de los productos y de los datos de ejemplo."),
  ...T("Pruebas de concepto analizadas", ["PoC", "Tecnología", "Productos públicos", "Origen de los datos"], [
    ["senamhi-hidrologia", "Angular", "Monitoreo, pronóstico y avisos hidrológicos", "Archivos JSON locales: estaciones, umbrales, entradas de pronóstico y avisos"],
    ["senamhi-meteorologia-dashboard", "Next.js", "Pronóstico y avisos meteorológicos", "Datos semilla (seed.ts), estaciones.json y límites departamentales INEI"]
  ], [2300, 1300, 2600, 2870]),
  H2("4.1 Hallazgos"),
  ...T("Hallazgos y decisiones derivadas", ["Hallazgo", "Decisión"], [
    ["Las PoC no consumen servicios reales: usan datos locales o semilla.", "Definir un **contrato de datos** propio que los sistemas reales deberán cumplir."],
    ["Cada sistema usa una tecnología distinta (Angular, Next.js).", "**Desacoplar** el portal de esas tecnologías: solo se comparte el formato de los archivos."],
    ["La PoC meteorológica no tiene monitoreo público.", "Crear el producto `meteo-monitoreo` a partir del catálogo de estaciones."],
    ["Cada estación registra variables diferentes.", "Mostrar solo las variables que registra cada estación; un dato faltante se indica como «sin dato»."],
    ["Dos estaciones de Puno (Cuyo Cuyo y Capazo) tenían coordenadas en UTM y quedaban fuera del mapa.", "Se corrigieron y el contrato exige **lat/lon WGS84**."],
    ["Los portales completos dependen de muchos recursos y de servidores activos.", "Diseño **minimalista**: archivos estáticos, SVG generados en el navegador y ningún recurso externo."]
  ], [4535, 4535])
];

const s5 = [
  H1("5. Arquitectura de la solución"),
  H2("5.1 Principio de diseño"),
  P("El portal **no genera productos**: los generan los sistemas productores, que son la fuente oficial. El portal solo los **recibe, valida y muestra**. Para que funcione cuando los sistemas centrales fallan, no debe depender de que estén en línea en el momento de la consulta."),
  H2("5.2 Arquitectura propuesta: publicación de archivos estáticos"),
  P("Se adopta un modelo de **«buzón»** con tres componentes:"),
  ...N(["**Sistemas productores** (existentes): al generar un producto, lo validan contra el contrato y lo publican como archivo JSON.",
    "**Repositorio de productos**: un servidor web independiente que contiene `manifest.json` (qué productos hay y cuándo se emitieron) y los seis archivos de productos.",
    "**Portal de Contingencia**: un frontend estático que lee el manifiesto cada 60 s, descarga solo lo que cambió, valida cada archivo y guarda la última versión válida en el navegador."]),
  ...figura("fig-arquitectura", "Arquitectura del Portal de Contingencia: publicación y recepción por archivos estáticos"),
  H2("5.3 Alternativas evaluadas"),
  ...T("Comparación de alternativas de arquitectura", ["Criterio", "Archivos estáticos (elegida)", "API directa del sistema productor", "Backend propio con base de datos"], [
    ["Si cae el sistema central", "El portal sigue mostrando el último producto", "El portal también cae", "Depende de la sincronización"],
    ["Carga ante alta demanda", "Mínima; admite caché y CDN", "Toda la carga recae en el sistema central", "Requiere dimensionar el servidor"],
    ["Esfuerzo de los productores", "Exportar un archivo JSON", "Exponer y mantener una API", "Integrarse con el backend"],
    ["Componentes que operar", "Un servidor web estático", "Ninguno adicional", "Servidor de aplicación y base de datos"],
    ["Acoplamiento", "Solo el contrato de datos", "Tecnología de cada sistema", "Alto"],
    ["Tiempo de puesta en marcha", "Corto", "Medio", "Largo"]
  ], [2000, 2400, 2335, 2335]),
  H2("5.4 Por qué esta arquitectura"),
  ...B(["**Resiliencia:** si un sistema productor falla, su último producto válido sigue publicado y visible; los otros cinco productos no se ven afectados.",
    "**Alta concurrencia:** en una emergencia aumentan las visitas. Los archivos estáticos se sirven sin procesamiento y pueden ponerse detrás de un CDN.",
    "**Bajo costo de integración:** cada sistema solo tiene que exportar un archivo, sin cambiar su tecnología ni exponer servicios.",
    "**Operación mínima:** no hay servidor de aplicación ni base de datos que mantener, respaldar o asegurar.",
    "**Coherencia con la sede central:** se replica el esquema «muchos sistemas → un portal», pero con un acoplamiento mínimo."]),
  H2("5.5 Escalabilidad"),
  P("Esta versión integra los 6 productos actuales. La arquitectura permite agregar productos o sistemas sin afectar a los existentes: basta con definir el esquema del nuevo archivo en el contrato, agregar su entrada en el manifiesto y su tarjeta en el mosaico. Ningún otro sistema productor tiene que cambiar.")
];

const s6 = [
  H1("6. Flujo de datos"),
  H2("6.1 Publicación (sistema productor)"),
  ...N(["Genera el producto en formato JSON según el contrato.",
    "Lo valida (con la herramienta `tools/validar.mjs` o con un equivalente).",
    "Lo sube al repositorio con un nombre temporal y lo **renombra** al nombre final. El renombrado es atómico, así que el portal nunca lee un archivo a medio escribir.",
    "Actualiza `manifest.json` **al final**, con la nueva fecha de emisión."]),
  H2("6.2 Recepción (portal)"),
  ...N(["Al abrirse, muestra al instante la última versión válida guardada en el navegador.",
    "Cada 60 s (y al volver a la pestaña o recuperar la red) consulta el manifiesto, que pesa menos de 1 KB.",
    "Si cambió la fecha de emisión de un producto, descarga solo ese archivo.",
    "Lo valida contra el contrato. Si es válido, lo guarda y redibuja; si no, lo rechaza y conserva la versión anterior."]),
  ...figura("fig-secuencia", "Diagrama de secuencia de publicación y recepción de un producto"),
  H2("6.3 Actualidad de los datos («tiempo real»)"),
  P("Como son datos meteorológicos e hidrológicos, el objetivo es mostrarlos con la mayor actualidad posible. Se acordó un objetivo de **10 minutos** para el monitoreo, que es el ritmo habitual de transmisión de las estaciones automáticas. El portal detecta los datos nuevos por **consulta frecuente del manifiesto cada 60 s**. Esta opción no requiere ningún componente de servidor adicional y conserva la resiliencia."),
  ...T("Latencia de punta a punta", ["Tramo", "Tiempo", "Responsable"], [
    ["Medición y transmisión de la estación", "Según la red (habitualmente ≤ 10 min)", "Redes de observación"],
    ["Generación del producto", "Ciclo de emisión: cada 10 min en monitoreo", "Sistema productor"],
    ["Publicación en el repositorio", "Segundos", "Sistema productor"],
    ["Detección por el portal", "≤ 60 s", "Portal"],
    ["**Antigüedad máxima en pantalla**", "**≈ 11 min** (10 min + 1 min), si el productor cumple su ciclo", "—"]
  ], [3400, 3400, 2270]),
  ...figura("fig-latencia", "Actualidad de los datos: del dato medido al dato visible en el portal"),
  H2("6.4 Estados de un producto"),
  P("Cada producto tiene su propio estado, que se muestra en su tarjeta, en la tarjeta «Estado del servicio» y, si hay incidencias, en una franja superior."),
  ...T("Estados de un producto", ["Estado", "Cuándo ocurre", "Qué ve el usuario"], [
    ["Al día", "Llegó la emisión esperada y es válida", "Punto verde y «Emitido dd/mm hh:mm · hace X»"],
    ["Verificando", "Al abrir el portal, mientras consulta el repositorio", "La copia local, con punto gris"],
    ["Desactualizado", "Antigüedad mayor que 2 × la frecuencia (20 min en monitoreo)", "Aviso naranja; se sigue mostrando"],
    ["Sin conexión", "El repositorio no responde", "Franja superior y última versión recibida"],
    ["Rechazado", "El archivo nuevo no cumple el contrato", "Aviso rojo; se conserva la versión anterior"],
    ["No disponible", "Nunca llegó una versión válida", "Tarjeta «Producto no disponible» con el motivo"]
  ], [1800, 3600, 3670]),
  ...figura("fig-estados", "Diagrama de estados de un producto")
];

const s7 = [
  H1("7. Contrato de datos"),
  P("El contrato de datos es el **único punto de acuerdo** entre los sistemas productores y el portal. Está implementado en `js/datos/contrato.js` y lo usan tanto el portal como las herramientas de validación y publicación, así que **un archivo que pasa el validador es aceptado por el portal**. La especificación completa está en el Anexo A."),
  ...T("Reglas generales del contrato", ["Regla", "Detalle"], [
    ["Formato", "JSON en UTF-8"],
    ["Fechas y horas", "ISO 8601 con zona horaria (por ejemplo, 2026-11-02T10:00:00-05:00)"],
    ["Coordenadas", "lat/lon en grados decimales WGS84; no se admite UTM"],
    ["Niveles de peligro", "moderada · fuerte · extrema"],
    ["Umbrales", "[moderada, fuerte, extrema]; crecientes en avenida y decrecientes en vaciante"],
    ["Valores faltantes", "null (no -999 ni 0)"],
    ["Autocontenido", "Cada producto incluye lo necesario para mostrarse sin depender de otro"]
  ], [2400, 6670]),
  ...T("Productos del repositorio", ["Identificador", "Archivo", "Contenido principal", "Frecuencia"], [
    ["meteo-monitoreo", "meteo/monitoreo.json", "Estaciones, variables registradas, valor actual y serie", "10 min"],
    ["meteo-pronostico", "meteo/pronostico.json", "Ciudades capitales: T. máx., T. mín. y cielo por día", "720 min"],
    ["meteo-avisos", "meteo/avisos.json", "Avisos: nivel, vigencia, departamentos y evolución diaria", "1440 min"],
    ["hidro-monitoreo", "hidro/monitoreo.json", "Estaciones, umbrales, caudal y nivel actuales y serie", "10 min"],
    ["hidro-pronostico", "hidro/pronostico.json", "Caudal observado y pronosticado por modelo", "1440 min"],
    ["hidro-avisos", "hidro/avisos.json", "Avisos por avenida o vaciante: estación, valor y zonas", "1440 min"]
  ], [1900, 2100, 3770, 1300]),
  P("Ejemplo de manifiesto:", { keepNext: true }),
  ...codigo(['{', '  "contrato": "1.0",', '  "generado": "2026-11-02T15:02:10Z",', '  "productos": [', '    { "id": "meteo-monitoreo", "url": "meteo/monitoreo.json",', '      "emitido": "2026-11-02T15:00:00-05:00", "frecuencia_min": 10 },', '    ...', '  ]', '}'])
];

const s8 = [
  H1("8. Base de datos"),
  H2("8.1 ¿Se necesita una base de datos?"),
  nota("**Conclusión: el Portal de Contingencia no necesita base de datos.**"),
  ...B(["El portal es de **solo lectura**: no tiene usuarios, formularios ni contenido propio que guardar.",
    "Las **bases de datos ya existen en los sistemas productores**, que son la fuente oficial. El portal no las duplica.",
    "Una base de datos agregaría un punto de falla, mantenimiento, respaldos y costo, en contra del criterio minimalista y del objetivo de resiliencia."]),
  H2("8.2 Dónde se almacena cada dato"),
  ...T("Almacenamiento de la información", ["Nivel", "Qué guarda", "Responsable"], [
    ["Bases de datos de los sistemas productores", "Datos oficiales e históricos completos", "Cada sistema productor"],
    ["Repositorio de productos (archivos)", "La última emisión de cada producto", "Sistemas productores (publican) y OTI (aloja)"],
    ["Navegador del usuario (copia local)", "La última versión válida recibida de cada producto", "Portal (automático)"]
  ], [3200, 3600, 2270]),
  H2("8.3 Cuándo sí haría falta una base de datos"),
  P("En una fase posterior podría justificarse una base de datos si se piden funciones que hoy están fuera del alcance:"),
  ...T("Casos futuros que requerirían base de datos", ["Caso", "Descripción", "Recomendación"], [
    ["Histórico consultable", "Consultar avisos y registros de días o meses anteriores", "PostgreSQL en un componente aparte que genere archivos de consulta"],
    ["Gestión de contenidos", "Que Comunicaciones publique comunicados o banners", "Pequeño gestor con base de datos que publique un archivo más en el repositorio"],
    ["Estadísticas de uso", "Visitas, productos más consultados", "Analítica del servidor web o base de datos de registros, separada del portal"]
  ], [2100, 3300, 3670]),
  P("En todos los casos se mantiene el principio de la arquitectura: el **portal sigue leyendo archivos estáticos**, y cualquier base de datos vive en un componente separado que no afecta su disponibilidad.")
];

const s9 = [
  H1("9. Tecnologías"),
  H2("9.1 Frontend del portal"),
  ...T("Tecnologías del frontend", ["Tecnología", "Uso en el portal"], [
    ["HTML5 y CSS3 (variables, Grid)", "Estructura, diseño adaptable a celular y modo claro u oscuro"],
    ["JavaScript estándar (módulos ES)", "Lógica de la aplicación, sin frameworks ni compilación"],
    ["SVG", "Mapas y gráficos generados en el navegador, sin imágenes que descargar"],
    ["Fetch API", "Descarga del manifiesto y de los productos, con tiempo de espera"],
    ["localStorage", "Copia local de la última versión válida de cada producto"],
    ["Service Worker", "Abrir la aplicación aunque el servidor web no responda"],
    ["API Intl", "Fechas en hora de Lima y formato numérico peruano"]
  ], [3200, 5870]),
  H2("9.2 Herramientas de soporte"),
  P("Las herramientas usan **Node.js 18 o superior**, sin dependencias, y **no se instalan en producción**: sirven a los productores y a la demostración."),
  ...T("Herramientas incluidas", ["Herramienta", "Función"], [
    ["tools/publicar.mjs", "Valida un producto y lo publica de forma atómica, actualizando el manifiesto"],
    ["tools/validar.mjs", "Valida un repositorio completo: manifiesto, archivos, contrato y fechas"],
    ["tools/generar-ejemplos.mjs", "Genera el repositorio de demostración (con modo continuo cada 10 min)"],
    ["tools/servidor.mjs", "Servidor web local para probar el portal"]
  ], [3200, 5870]),
  H2("9.3 Tecnologías recomendadas para producción"),
  ...T("Componentes de producción recomendados", ["Componente", "Recomendación"], [
    ["Servidor web", "Nginx; IIS como alternativa si la OTI trabaja con Windows Server"],
    ["Seguridad del canal", "HTTPS con certificado TLS"],
    ["Alta concurrencia (opcional)", "CDN delante del portal y del repositorio"],
    ["Transferencia de productos", "SFTP o rsync por SSH, con una cuenta de servicio por sistema productor"],
    ["Vigilancia", "Monitor de disponibilidad que alerte si el manifiesto deja de actualizarse"]
  ], [3200, 5870]),
  H2("9.4 Por qué no se usan frameworks"),
  P("Las PoC usan Angular y Next.js, que son adecuados para aplicaciones completas. Para un portal de contingencia se priorizó lo contrario: **poco peso, carga rápida con poco ancho de banda, ningún proceso de compilación y ninguna librería que actualizar**. Si la OTI exige un framework estándar, el portal puede migrarse sin cambiar el contrato de datos ni a los sistemas productores."),
  H2("9.5 Compatibilidad"),
  P("Navegadores actuales (Edge, Chrome, Firefox y Safari de los últimos dos años), en computadora, tableta y celular.")
];

const s10 = [
  H1("10. Diseño de la interfaz"),
  H2("10.1 Principios de diseño"),
  ...B(["**Lo urgente primero:** los avisos vigentes y su nivel se ven sin desplazarse, en cualquier pantalla.",
    "**Una plantilla, seis productos:** filtros, mapa y detalle se repiten; quien aprende un producto ya sabe usar los otros cinco.",
    "**Ligero y resistente:** sin dependencias pesadas, mapas en SVG y carga rápida en redes lentas.",
    "**Nunca solo color:** todo nivel se acompaña de texto («▲ FUERTE») para ser accesible."]),
  H2("10.2 Wireframes y guía de UI"),
  P("El diseño se trabajó en tres niveles: wireframe de baja fidelidad (estructura), prototipo navegable y guía de UI con los tokens de color, tipografía, componentes y accesibilidad."),
  ...figura("cap-wireframe-baja", "Wireframe de baja fidelidad del mosaico, con anotaciones de UX"),
  ...figura("cap-guia-ui", "Guía de UI: principios y paleta de colores del SENAMHI"),
  H2("10.3 Mosaico"),
  P("La composición sigue el esquema tipo «bento» del Observatorio: el monitoreo meteorológico destacado a la izquierda, el mapa nacional con capas al centro, los avisos a la derecha y, en la fila inferior, los pronósticos, el monitoreo hidrológico y el estado del servicio."),
  ...figura("cap-mosaico", "Mosaico del Portal de Contingencia con los seis productos"),
  ...T("Niveles de peligro", ["Nivel", "Color", "Uso"], [
    ["Moderada", "Amarillo", "Avisos y umbrales de nivel 2"],
    ["Fuerte", "Naranja", "Avisos y umbrales de nivel 3"],
    ["Extrema", "Rojo", "Avisos y umbrales de nivel 4"]
  ], [2400, 2400, 4270]),
  H2("10.4 Vistas ampliadas"),
  P("Al seleccionar un producto se abre su vista ampliada en la misma página: mapa a la izquierda y panel de detalle a la derecha. Cada vista tiene un enlace directo para compartir."),
  ...figura("cap-hidro-avisos", "Vista ampliada de avisos hidrológicos: aviso, hidrograma con umbrales y zonas de afectación"),
  ...figura("cap-meteo-avisos", "Vista ampliada de avisos meteorológicos: evolución por día y departamentos afectados"),
  ...figura("cap-hidro-pronostico", "Vista ampliada del pronóstico hidrológico: caudal observado y pronosticado por modelo"),
  ...figura("cap-meteo-monitoreo", "Vista ampliada del monitoreo meteorológico: solo las variables que registra la estación"),
  H2("10.5 Versión móvil"),
  P("En pantallas angostas el mosaico pasa a una sola columna y prioriza los avisos."),
  ...figura("cap-movil", "Vista en pantalla angosta", 190)
];

const s11 = [
  H1("11. Seguridad y resiliencia"),
  H2("11.1 Seguridad"),
  ...B(["**Validación:** todo archivo recibido se valida contra el contrato antes de usarse.",
    "**Escape de textos:** todo texto de un producto se escapa antes de insertarlo en la página, lo que previene la inyección de código.",
    "**Enlaces seguros:** los enlaces a documentos solo admiten http y https.",
    "**Superficie mínima:** el portal no tiene usuarios, contraseñas, formularios ni base de datos.",
    "**Sin recursos externos:** no carga fuentes, librerías ni scripts de terceros.",
    "**Canal cifrado:** en producción se sirve por HTTPS; si el repositorio está en otro dominio, se limita con CORS."]),
  H2("11.2 Resiliencia"),
  ...T("Mecanismos de resiliencia", ["Mecanismo", "Protege ante"], [
    ["Copia local de la última versión válida", "Caída del repositorio o de la red"],
    ["Validación y rechazo de archivos", "Errores de los sistemas productores"],
    ["Publicación atómica y manifiesto al final", "Lectura de archivos a medio escribir"],
    ["Productos independientes y autocontenidos", "Falla de un producto que afecte a los demás"],
    ["Estado visible de cada producto", "Mostrar información vieja sin advertirlo"],
    ["Service Worker", "Caída del servidor web del portal"]
  ], [4535, 4535]),
  ...figura("cap-falla-con-copia", "Producto rechazado y producto que no llegó: se conserva la versión anterior y se informa la incidencia", 480),
  ...figura("cap-falla-sin-copia", "Sin versión previa: el producto se marca «no disponible» y los demás siguen funcionando", 480),
  ...figura("cap-repo-caido", "Repositorio inaccesible: franja «Sin conexión» y reintento automático", 540)
];

const s12 = [
  H1("12. Recursos necesarios"),
  H2("12.1 Infraestructura"),
  ...T("Recursos de infraestructura", ["Recurso", "Característica"], [
    ["Servidor web o hosting estático", "1 vCPU, 1–2 GB de RAM y 20 GB de disco, **fuera de la infraestructura principal**"],
    ["Subdominio", "Por ejemplo, contingencia.senamhi.gob.pe"],
    ["Certificado TLS", "Para servir el portal y el repositorio por HTTPS"],
    ["Espacio para el repositorio", "Unos pocos MB (≈ 105 KB por emisión completa)"],
    ["Cuentas de servicio SFTP", "Una por sistema productor, con permiso solo sobre su carpeta"],
    ["Reglas de firewall", "Acceso de los sistemas productores al repositorio"],
    ["Monitor de disponibilidad", "Alerta si el portal no responde o si el manifiesto deja de actualizarse"],
    ["CDN (opcional)", "Para absorber picos de visitas durante una emergencia"]
  ], [3200, 5870]),
  H2("12.2 Personas y roles"),
  ...T("Roles y responsabilidades", ["Rol", "Responsabilidad"], [
    ["OTI", "Infraestructura, despliegue, certificados, seguridad y cuentas de servicio"],
    ["Equipos de los sistemas productores (hidrología y meteorología)", "Exportar sus productos según el contrato, validarlos y publicarlos"],
    ["Unidad de Comunicaciones", "Validar contenidos, entregar logotipos y datos de contacto, y difundir el portal durante una contingencia"],
    ["Responsable de operación", "Vigilar el estado del servicio y coordinar ante incidencias"]
  ], [3600, 5470]),
  H2("12.3 Software"),
  P("No se requieren licencias. El servidor web (Nginx) es de código abierto. Los sistemas productores que usen las herramientas de referencia necesitan **Node.js 18 o superior**; si no, pueden replicar el procedimiento de publicación en su propio lenguaje.")
];

const s13 = [
  H1("13. Despliegue y operación"),
  H2("13.1 Pasos de despliegue"),
  ...N(["Copiar al servidor web `index.html`, `sw.js` y las carpetas `css/` y `js/` (no se despliegan `tools/` ni `docs/`).",
    "Crear el repositorio de productos (en el mismo servidor o en otro) con la estructura de `productos/`.",
    "Configurar en `js/config.js` la URL del repositorio, el intervalo de consulta y los datos institucionales.",
    "Servir `manifest.json` y los productos con la cabecera `Cache-Control: no-cache`; si el repositorio está en otro dominio, agregar la cabecera CORS.",
    "Habilitar HTTPS y el monitor de disponibilidad.",
    "Crear las cuentas SFTP y entregar a cada sistema productor el contrato de datos y las herramientas."]),
  H2("13.2 Configuración"),
  ...T("Parámetros de js/config.js", ["Parámetro", "Valor", "Descripción"], [
    ["repositorio", "productos/", "URL del repositorio de productos"],
    ["intervalo_s", "60", "Frecuencia de consulta del manifiesto (segundos)"],
    ["timeout_ms", "10000", "Tiempo máximo de cada descarga"],
    ["tolerancia", "2", "Desactualizado si la antigüedad supera frecuencia × tolerancia"],
    ["institucion.contacto", "Por confirmar", "Texto del pie de página"]
  ], [2400, 1800, 4870]),
  H2("13.3 Operación ante incidencias"),
  ...T("Guía de atención de incidencias", ["Síntoma en el portal", "Causa probable", "Acción"], [
    ["Producto «desactualizado»", "El sistema productor no publicó a tiempo", "Revisar el proceso de exportación del sistema productor"],
    ["Producto «rechazado»", "El archivo no cumple el contrato", "Ejecutar tools/validar.mjs y corregir según el error indicado"],
    ["Franja «Sin conexión»", "El repositorio no responde", "Revisar el servidor del repositorio y la red"],
    ["Producto «no disponible»", "Nunca se publicó o no figura en el manifiesto", "Verificar el manifiesto y la publicación inicial"]
  ], [2600, 3000, 3470])
];

const s14 = [
  H1("14. Pruebas realizadas"),
  P("Las pruebas se realizaron con el repositorio de demostración, en el navegador Microsoft Edge (modo sin interfaz), en escritorio (1440 px) y en pantalla angosta."),
  ...T("Resultados de las pruebas", ["N.º", "Prueba", "Resultado esperado", "Resultado"], [
    ["1", "Carga del mosaico", "8 tarjetas con datos y sin errores en la consola", "Conforme"],
    ["2", "Vistas ampliadas de los 6 productos", "Mapa y detalle de cada producto; enlace directo", "Conforme"],
    ["3", "Pantalla angosta", "Una columna, avisos primero", "Conforme"],
    ["4", "Validación de un producto inválido", "Se rechaza y se explica cada error (3 errores detectados)", "Conforme"],
    ["5", "Publicación de un producto inválido", "No se publica y no se modifica el manifiesto", "Conforme"],
    ["6", "Archivo inválido con versión previa", "Se conserva la versión anterior y se marca «rechazado»", "Conforme"],
    ["7", "Archivo inexistente (HTTP 404)", "Se informa la incidencia; los demás productos siguen", "Conforme"],
    ["8", "Primera visita sin versión previa", "Tarjeta «no disponible» con el motivo", "Conforme"],
    ["9", "Repositorio inaccesible", "Franja «Sin conexión» y reintento automático", "Conforme"],
    ["10", "Archivo con marca BOM (Windows)", "Se acepta sin error", "Conforme"],
    ["11", "Apertura con el servidor web apagado", "La aplicación abre desde el Service Worker", "Pendiente de verificar en un navegador normal"]
  ], [700, 2700, 3870, 1800]),
  nota("La prueba 11 no se pudo verificar porque el navegador en modo sin interfaz no usa el Service Worker en la primera navegación. La funcionalidad está implementada y se recomienda verificarla en un navegador normal durante la validación con el área usuaria.")
];

const s15 = [
  H1("15. Riesgos, pendientes y recomendaciones"),
  H2("15.1 Riesgos"),
  ...T("Riesgos identificados", ["Riesgo", "Impacto", "Mitigación"], [
    ["Los sistemas productores no adaptan su exportación al contrato", "Alto", "Entregar el contrato, el validador y las herramientas de referencia; acompañar la primera integración"],
    ["El repositorio se aloja en la misma infraestructura que falla", "Alto", "Alojar el portal y el repositorio fuera de la infraestructura principal"],
    ["Un sistema productor deja de publicar", "Medio", "Estado «desactualizado» visible y monitor de disponibilidad"],
    ["Picos de visitas durante una emergencia", "Medio", "Archivos estáticos con caché y CDN opcional"],
    ["Cambios no coordinados en el contrato", "Medio", "Versionado del contrato: solo campos opcionales en 1.x"]
  ], [3400, 1200, 4470]),
  H2("15.2 Pendientes"),
  ...B(["Integración real con los sistemas productores de hidrología y meteorología.",
    "Logotipos oficiales y datos de contacto institucionales.",
    "Incorporar las observaciones del área usuaria del taller del 31/10/2026.",
    "Definir con la OTI el alojamiento, el subdominio y las cuentas de servicio.",
    "Verificar la apertura sin servidor web (Service Worker) en un navegador normal."]),
  H2("15.3 Recomendaciones"),
  ...B(["Empezar la integración por los **avisos**, que son el producto más crítico en una contingencia.",
    "Pedir a cada sistema productor que valide sus archivos con `tools/validar.mjs` antes de su primera publicación.",
    "Realizar un simulacro periódico de contingencia para comprobar que el portal opera con los sistemas centrales apagados.",
    "Evaluar en una fase posterior el histórico, la gestión de contenidos y las estadísticas en un componente separado."])
];

const anexoA = [
  H1("16. Anexos"),
  H2("Anexo A. Contrato de datos (campos por producto)"),
  P("Todo archivo tiene un sobre común: `contrato` (versión), `producto` (identificador), `emitido` (fecha-hora ISO), `fuente` (texto) y `datos` (contenido del producto). Los campos marcados como opcionales pueden omitirse."),
  ...T("meteo-monitoreo · datos.estaciones[]", ["Campo", "Tipo", "Descripción"], [
    ["id, nombre, departamento, provincia", "texto", "Identificación de la estación"],
    ["altitud, lat, lon", "número", "m s. n. m. y coordenadas WGS84"],
    ["variables", "lista", "Variables que registra: T, HR, PP, V"],
    ["actual.fecha / actual.<var>", "fecha / número o null", "Último valor de cada variable declarada"],
    ["serie (opcional)", "objeto", "inicio, paso_min y una lista por variable"]
  ], [3400, 2000, 3670]),
  ...T("meteo-pronostico · datos", ["Campo", "Tipo", "Descripción"], [
    ["fechas", "lista de fechas", "Días del pronóstico (AAAA-MM-DD)"],
    ["ciudades[].departamento, ciudad", "texto", "Ubicación (nombres de la cartografía INEI)"],
    ["ciudades[].dias[]", "objeto", "tmax, tmin, cielo (código) y descripción; uno por fecha"]
  ], [3400, 2000, 3670]),
  ...T("meteo-avisos · datos.avisos[]", ["Campo", "Tipo", "Descripción"], [
    ["numero, nivel, titulo", "entero / nivel / texto", "Identificación del aviso"],
    ["emitido, inicio, fin, duracion_h", "fecha-hora / número", "Vigencia del aviso"],
    ["estado (opcional)", "emitido · cancelado", "Un aviso cancelado deja de estar vigente"],
    ["departamentos, cuerpo, dias[] (opcionales)", "lista / texto / objeto", "Detalle y evolución diaria"],
    ["peligro, recomendacion, documento (opcionales)", "texto", "Textos del nivel y PDF oficial"]
  ], [3400, 2000, 3670]),
  ...T("hidro-monitoreo · datos.estaciones[]", ["Campo", "Tipo", "Descripción"], [
    ["id, nombre, rio, cuenca, departamento, provincia, distritos", "texto / lista", "Identificación y ubicación"],
    ["lat, lon, tipo_umbral", "número / avenida · vaciante", "Coordenadas y sentido de la alerta"],
    ["umbrales.caudal, umbrales.nivel (opcional)", "lista de 3 números", "[moderada, fuerte, extrema]"],
    ["actual.fecha, caudal, nivel", "fecha / número o null", "Valor actual; null = sin datos"],
    ["serie (opcional)", "objeto", "inicio, paso_min, caudal y nivel"]
  ], [3400, 2000, 3670]),
  ...T("hidro-pronostico · datos.estaciones[]", ["Campo", "Tipo", "Descripción"], [
    ["id, nombre, rio, departamento, lat, lon", "texto / número", "Estación (autocontenida)"],
    ["tipo_umbral, umbrales_caudal", "texto / lista", "Para calcular el estado del pronóstico"],
    ["observado.fechas, observado.caudal", "listas", "Caudal observado reciente"],
    ["pronostico.fechas, pronostico.modelos[]", "listas", "Caudal pronosticado por cada modelo"]
  ], [3400, 2000, 3670]),
  ...T("hidro-avisos · datos.avisos[]", ["Campo", "Tipo", "Descripción"], [
    ["numero, nivel, tipo, titulo, descripcion", "varios", "Identificación y texto del aviso"],
    ["emitido, inicio, fin, duracion_h", "fecha-hora / número", "Vigencia"],
    ["variable, valor, unidad, tendencia", "varios", "Medición que originó el aviso"],
    ["estacion", "objeto", "Estación, ubicación, centros poblados y umbrales"],
    ["serie, peligro, recomendacion, documento (opcionales)", "varios", "Hidrograma, textos y PDF oficial"]
  ], [3400, 2000, 3670]),
  P("La especificación detallada, con ejemplos completos y el procedimiento de publicación, está en `portal/docs/contrato-datos.md`."),
  H2("Anexo B. Estructura del código fuente"),
  ...codigo(["portal/",
    "├── index.html                 Página única del mosaico",
    "├── sw.js                      Service Worker (apertura sin conexión)",
    "├── css/portal.css             Estilos (tokens de la guía de UI)",
    "├── js/",
    "│   ├── app.js                 Arranque, eventos y ciclo de actualización",
    "│   ├── config.js              Configuración de despliegue",
    "│   ├── datos/contrato.js      Contrato de datos y validador",
    "│   ├── datos/repositorio.js   Recepción, rechazo, copia local, salud",
    "│   ├── datos/modelo.js        Contrato → modelo de vista",
    "│   ├── ui/mosaico.js          Tarjetas del mosaico",
    "│   ├── ui/detalle.js          Vistas ampliadas",
    "│   ├── ui/graficos.js         Mapa SVG, gráficos, indicador",
    "│   ├── ui/estado.js           Estado de la interfaz",
    "│   ├── ui/util.js             Formato SI, fechas, iconos",
    "│   └── geo/peru.js            Cartografía base INEI",
    "├── productos/                 Repositorio de demostración",
    "├── tools/                     Herramientas Node (no se despliegan)",
    "└── docs/                      Arquitectura y contrato de datos"]),
  ...figura("fig-componentes", "Componentes del frontend organizados en capas"),
  H2("Anexo C. Manual de ejecución de la demostración"),
  ...N(["Verificar que Node.js 18 o superior esté instalado: `node -v`.",
    "Abrir una terminal en la carpeta del portal: `cd \"C:\\Users\\Usuario\\Downloads\\E5\\Portal de Contingencia\\portal\"`.",
    "Actualizar los productos de ejemplo a la hora actual: `node tools/generar-ejemplos.mjs` (con `--continuo` se vuelven a publicar cada 10 min).",
    "Levantar el servidor: `node tools/servidor.mjs 8731`.",
    "Abrir en el navegador: http://localhost:8731",
    "Para detenerlo, presionar Ctrl + C en la terminal."]),
  nota("El portal no funciona abriendo index.html con doble clic, porque el navegador bloquea la lectura de los archivos de productos desde el disco. Siempre debe servirse por HTTP.")
];

/* ---------------- documento ---------------- */
const encabezado = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.sol, space: 4 } }, children: [new TextRun({ text: "Portal de Contingencia · Informe técnico de Análisis y Diseño", font: FONT, size: 16, color: C.gris })] })] });
const pie = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: FONT, size: 16, color: C.gris, children: ["SENAMHI · Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES] })] })] });

const doc = new Document({
  creator: "Franklin Miguel Silva Maguiña", title: "Informe técnico · Portal de Contingencia", description: "Análisis y Diseño de la versión minimalista del Portal de Contingencia del SENAMHI",
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: C.texto } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 34, bold: true, color: C.marino, font: FONT }, paragraph: { spacing: { before: 120, after: 240 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.sol, space: 6 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: C.azul, font: FONT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: C.marino, font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } }
    ]
  },
  numbering: { config: [
    { reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    { reference: "numeros", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] }
  ] },
  sections: [{
    properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1418, right: 1418, header: 708, footer: 708 } } },
    headers: { default: encabezado, first: new Header({ children: [new Paragraph({ children: [] })] }) },
    footers: { default: pie, first: new Footer({ children: [new Paragraph({ children: [] })] }) },
    children: [...caratula, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8, ...s9, ...s10, ...s11, ...s12, ...s13, ...s14, ...s15, ...anexoA]
  }]
});

// Numbering lists restart: docx-js reuses one instance per reference; acceptable for this document.
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(SALIDA, buf); console.log("OK", SALIDA, (buf.length / 1024).toFixed(0) + " KB", `· ${nFig} figuras · ${nTab} tablas`); });
