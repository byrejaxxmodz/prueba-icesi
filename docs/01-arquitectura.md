# Parte 1 — Diseño de la solución: Vista 360° del Estudiante

> Diagrama: [`diagrama-arquitectura.svg`](./diagrama-arquitectura.svg)

## 1. Resumen de la decisión

Vista 360° **no reemplaza ningún sistema existente**. Se diseña como una capa nueva compuesta por:

- Un **frontend** único con vistas condicionadas por rol (estudiante / equipo de acompañamiento).
- Un **API Gateway / BFF** como única puerta de entrada del frontend.
- Un **Servicio de Agregación** ("Vista 360 Core") que **no almacena** información académica, financiera ni de campus — la consulta en vivo (con cache corta) a los sistemas fuente a través de adaptadores.
- Un **Servicio de Acompañamiento**, dueño de un dominio de datos **nuevo** (reportes, alertas, solicitudes), con su propia base de datos.
- Un **bus de eventos** para propagar cambios relevantes hacia el data warehouse y hacia otros procesos, sin acoplar a Vista 360 con esos consumidores.

La razón de fondo: la plataforma tiene **dos tipos de datos con naturaleza muy distinta** y cada uno debe tratarse distinto.

1. Datos que **ya tienen dueño** (personal, académico, financiero, actividad de campus) → Vista 360 los **consume**, no los duplica ni se vuelve la fuente de verdad. Duplicarlos crearía problemas de consistencia (¿qué pasa si la nota cambia en el sistema académico y no se propaga?) y de gobierno de datos (¿quién es responsable del dato si vive en dos lugares?).
2. Datos que **no existen hoy en ningún sistema** (reportes de acompañamiento, alertas, solicitudes) → Vista 360 sí debe **poseerlos**, porque nadie más los tiene y el caso pide explícitamente poder "persistir para su consulta y gestión".

## 2. De dónde sale cada dato y por qué

| Dato que necesita Vista 360 | Fuente | Por qué se resolvió así |
|---|---|---|
| Datos personales / identidad (nombre, contacto, rol) | Directorio institucional / Sistema Académico (SIS) | Se asume que la universidad ya tiene un directorio o SIS que es la fuente maestra de identidad. Vista 360 no debe convertirse en un segundo lugar donde editar el nombre de un estudiante. |
| Información académica (materias matriculadas, notas actuales, historial, condición académica) | Sistema Académico (SIS) | Es un sistema transaccional vivo: matrícula y notas cambian dentro del semestre. Consultarlo en vivo (o reaccionar a sus eventos) evita mostrarle al estudiante una nota vieja. |
| Información financiera (estado de cuenta, pagos, becas) | Sistema Financiero (ERP) | Es información regulada/auditada por otro dominio (financiero). Vista 360 no debe reimplementar reglas de facturación o becas; solo las consulta y las muestra. |
| Actividad en campus virtual | Campus Virtual (LMS) | El LMS es quien genera esos eventos de uso; se asume que expone indicadores ya calculados (accesos, entregas, participación), no telemetría cruda. |
| Reportes de acompañamiento, alertas, solicitudes | **Base de datos propia de Vista 360** (Servicio de Acompañamiento) | No existen en ningún sistema actual. Son el único dato del que Vista 360 es dueña, porque es quien los crea. |
| Identidad para login / roles | Directorio / IdP institucional | Se asume SSO institucional (OIDC/SAML) ya existente; reutilizarlo evita una segunda base de usuarios/contraseñas que mantener y asegurar. |
| Modelos de analítica | Data Warehouse (destino, no fuente) | Se alimenta desde los sistemas fuente (ya existente, se asume) y desde Vista 360 (nuevo, vía eventos), pero Vista 360 nunca *lee* del DW para operar. |

## 3. Cómo se comunican los componentes

- **Frontend → API Gateway/BFF**: síncrono, REST/HTTPS, con JWT emitido por el IdP institucional. El BFF es el único punto que el frontend conoce; internamente decide a qué servicio enrutar y cómo agregar la respuesta (por ejemplo, para la vista "estudiante" el BFF junta en una sola respuesta datos de tres orígenes distintos).
- **API Gateway → Servicio de Agregación / Servicio de Acompañamiento**: síncrono, REST interno dentro del mismo perímetro de confianza, propagando el contexto del usuario autenticado (para poder aplicar autorización a nivel de fila, ver Parte 3).
- **Servicio de Agregación → sistemas fuente**: nunca directo. Siempre pasa por un **adaptador por sistema** (anti-corruption layer), para que un cambio en el SIS o el ERP no obligue a tocar la lógica de negocio de Vista 360. Se usa cache de muy corta duración (segundos/pocos minutos) para no golpear sistemas legados en cada refresh de pantalla.
- **Servicio de Acompañamiento → su propia BD**: es transaccional y síncrona, porque este servicio sí es la fuente de verdad de esos datos.
- **Cambios relevantes → Bus de eventos (pub/sub)**: cuando se crea una alerta/reporte, o cuando el sistema académico informa un cambio de condición académica, se publica un evento de dominio. De ahí lo consumen, de forma desacoplada: (a) el pipeline de ingesta al data warehouse, y (b) otros procesos interesados (notificaciones, CRM académico). Esto evita que Vista 360 tenga que conocer o llamar directamente a cada consumidor futuro.

## 4. Supuestos declarados

Estos son los puntos que el caso deja abiertos a propósito. Los resuelvo así porque son la opción más razonable sin más contexto, y los declaro para que sea explícito qué parte del diseño depende de ellos:

1. **La universidad ya tiene un IdP/SSO institucional** (OIDC o SAML) para estudiantes y personal. Vista 360 federa contra él en vez de gestionar sus propias contraseñas. Si no existiera, habría que construirlo primero — no es responsabilidad de Vista 360 crearlo.
2. **Los sistemas fuente (SIS, ERP, LMS) exponen alguna interfaz programática** (API REST/SOAP) o al menos una vía de solo lectura (vista de BD, réplica). Si algún sistema no la tiene, la solución es construirle un adaptador que sí la exponga — pero el diseño de Vista 360 no cambia, porque toda esa complejidad queda aislada en la capa de adaptadores.
3. **"Actividad en campus virtual" se refiere a indicadores ya agregados** (accesos, entregas, participación), no a eventos crudos en tiempo real. Si se necesitara tiempo real, ese indicador pasaría por el mismo bus de eventos en vez de por consulta síncrona.
4. **El data warehouse es solo destino**, nunca se le escribe transaccionalmente en tiempo real desde Vista 360; se alimenta por eventos/lotes. Ninguna funcionalidad operativa de Vista 360 depende de leer del DW.
5. **"Condición académica" la calcula y posee el Sistema Académico**; Vista 360 reacciona a su cambio (Parte 3, escenario B) en vez de recalcularla.
6. **Se prioriza consistencia eventual** en la mayoría de flujos (alertas, DW), excepto en la consulta financiera puntual (Parte 3, escenario A), donde se prioriza que el estudiante vea el dato más fresco posible bajo demanda.
7. **El equipo de acompañamiento tiene estudiantes "asignados"** (una relación acompañante–estudiante que debe existir en algún sistema, se asume que vive en el propio Servicio de Acompañamiento o se sincroniza desde el sistema académico). Esta relación es la que sostiene la autorización de la Parte 3.

## 5. Qué decisiones se dejaron abiertas a propósito

El enunciado aclara que "qué se guarda, dónde y cómo" queda a criterio propio. Las decisiones de almacenamiento concretas (motor de BD, particionamiento, retención) se desarrollan en la Parte 2 para el servicio implementado, y no se generalizan aquí para el resto de la plataforma porque dependerían de volumetría y SLAs reales que el caso no define.
