# Prueba Técnica — Semillero de Ingeniero de Arquitectura e Innovación

Caso: **Vista 360° del Estudiante**.

## Índice de entregables

| Parte | Entregable |
|---|---|
| 1 — Diseño de la solución | [`docs/diagrama-arquitectura.svg`](docs/diagrama-arquitectura.svg) (diagrama) + [`docs/01-arquitectura.md`](docs/01-arquitectura.md) (decisiones y supuestos) |
| 2 — Servicio: especificación e implementación | [`service/`](service/) (código) + [`service/README.md`](service/README.md) (contrato, modelo de datos, cómo correrlo) |
| 3 — Seguridad y comunicación | [`docs/03-seguridad-comunicacion.md`](docs/03-seguridad-comunicacion.md) |
| 4 — Operación y calidad | [`docs/04-operacion-calidad.md`](docs/04-operacion-calidad.md) |

## Resumen rápido

- **Parte 1:** Vista 360 se diseña como una capa nueva que no duplica los sistemas existentes: los datos que ya tienen dueño (académico, financiero, campus) se consultan en vivo a través de adaptadores; los datos nuevos (reportes de acompañamiento, alertas, solicitudes) sí los persiste Vista 360 porque nadie más los tiene.
- **Parte 2:** servicio Node.js/Express/TypeScript + SQLite que, dado el id de un estudiante, devuelve sus materias matriculadas activas y su nota actual. Incluye autorización (un estudiante solo ve lo suyo) y 10 pruebas de integración pasando.
- **Parte 3:** autenticación federada contra el IdP institucional (SSO/OIDC) + autorización por rol y por dueño del registro; la consulta financiera se resuelve síncrona (freshness bajo demanda) y el cambio de condición académica se resuelve por eventos (múltiples consumidores desacoplados).
- **Parte 4:** qué se necesita desde el diseño para diagnosticar fallas intermitentes (trazabilidad distribuida, métricas por dependencia, circuit breakers) y para responder con certeza un reclamo de acceso indebido (auditoría inmutable de accesos y cambios).

## Uso de IA

Autor: **Jaime Andrés Muñoz Londoño** — A00403917.

Se usaron herramientas de IA como apoyo durante toda la prueba:

- **Claude (Claude Code)** produjo la primera versión de los entregables: interpretar el enunciado (incluyendo extraer el texto del `.docx` original), razonar y redactar las decisiones de arquitectura y los supuestos de la Parte 1, construir el diagrama, diseñar, implementar y probar el servicio de la Parte 2, y redactar las respuestas argumentadas de las Partes 3 y 4.
- **GPT 5.6 (vía OpenCode)** lo usé para verificar y revisar todo lo que hizo Claude Code: contrasté las decisiones de arquitectura, revisé el código y las pruebas del servicio, y validé la coherencia de las respuestas de las Partes 3 y 4.

La ideación y el criterio técnico fueron un trabajo conjunto: yo participé en la ideación de la solución, definí el alcance (elección del stack del servicio y del repositorio), dirigí las decisiones de diseño (qué patrones aplicar, qué supuestos declarar, cómo justificar cada decisión) y revisé cada entregable con apoyo de GPT 5.6 antes de darlo por final. No se generó un documento a partir de un prompt único sin revisión.
