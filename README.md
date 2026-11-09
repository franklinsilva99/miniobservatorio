# Mini Observatorio · Portal de Contingencia del SENAMHI

**Sistema Informático para el apoyo a la Continuidad Operativa del SENAMHI**, Fase 1, Módulo 4: análisis y diseño de la versión minimalista del Portal de Contingencia (monitoreo, pronósticos y avisos).

**Área usuaria:** Unidad de Comunicaciones · **Periodo:** 08/10/2026 al 06/11/2026

El Portal de Contingencia es un canal alterno de difusión que muestra en **un solo mosaico** los seis productos hidrometeorológicos: monitoreo, pronóstico y avisos, de meteorología y de hidrología. Replica el esquema de la sede central (muchos sistemas productores y un portal que muestra sus productos), pero está diseñado para **seguir funcionando cuando los sistemas centrales no están disponibles**.

```
Sistemas productores ──publican──▶ Repositorio (manifiestos + 6 JSON) ◀──lee cada 5 min── Portal
```

## Contenido del repositorio

| Carpeta | Contenido |
|---|---|
| [`portal/`](portal/) | **Código fuente del portal**: frontend, contrato de datos, herramientas de publicación y validación, y documentación técnica. Ver [`portal/README.md`](portal/README.md). |
| [`wireframes/`](wireframes/) | Diseño: wireframe de baja fidelidad, prototipo de alta fidelidad y guía de UI. |
| [`informe/`](informe/) | Informe técnico de Análisis y Diseño (Word y PDF), imágenes, fuentes de los diagramas y generador del informe. |

## Ver el portal

Requiere [Node.js](https://nodejs.org) 18 o superior y el backend de hidrología publicando en `portal/productos/` (ver [`portal/README.md`](portal/README.md)). No hay que instalar dependencias.

```bash
cd portal
node tools/servidor.mjs 8731      # http://localhost:8731
```

> No funciona abriendo `index.html` con doble clic: hay que servirlo por HTTP.

## Documentación

- [Arquitectura](portal/docs/arquitectura.md): decisión, alternativas, flujo de datos, estados y despliegue.
- [Contrato de datos](portal/docs/contrato-datos.md): especificación para los sistemas productores.
- [Informe técnico](informe/Informe-Tecnico-Portal-Contingencia.pdf): documento completo del entregable.

## Características principales

- **Sin base de datos ni servidor de aplicación:** basta con un servidor web estático (Nginx o IIS).
- **HTML, CSS y JavaScript estándar**, sin frameworks ni compilación: unos 150 KB de aplicación.
- **Actualidad:** el portal detecta lo publicado en unos 6 min como máximo.
- **Resiliencia:** cada archivo se valida contra el contrato; si falla, se conserva la última versión válida y se informa la incidencia.

> Por ahora solo publica **hidrología**, con datos reales. La carpeta `portal/productos/` no se sube a git.
