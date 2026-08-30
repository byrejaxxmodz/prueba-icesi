# Parte 3 — Seguridad y comunicación

## 3.1 Seguridad: autenticación y autorización

**Autenticación.** Vista 360 no gestiona contraseñas propias: federa contra el **IdP institucional** (se asume SSO ya existente, tipo OIDC) tanto para estudiantes como para personal de acompañamiento. Tras el login, el IdP emite un **access token (JWT) de corta duración** (ej. 15 min) con al menos: `sub` (id de usuario), `rol` (`estudiante` | `acompañante`) y el tipo de sesión. Como el frontend es una SPA, se usa un patrón **BFF**: el token vive del lado del servidor (BFF), y el navegador solo mantiene una cookie de sesión `httpOnly`/`secure`. Esto evita que un XSS en el frontend pueda robar el token directamente (el riesgo más común en SPAs que guardan JWT en `localStorage`).

**Autorización.** Es de dos niveles, y **ambos se validan en el backend**, nunca solo en la UI:

1. **Por rol (RBAC)** — qué endpoints puede tocar cada tipo de usuario. Un estudiante no tiene acceso a los endpoints de registro de reportes/alertas; eso es exclusivo del rol acompañamiento.
2. **Por relación (autorización a nivel de registro)** — dentro de un endpoint permitido, qué *filas* puede ver:
   - Un **estudiante** solo puede pedir información cuyo `id` coincide con el `sub` de su propio token. El backend **ignora cualquier id que venga en la URL/payload y no coincida con el token**; esto es explícito porque es la falla más común (IDOR: cambiar el id en la URL y ver datos de otro estudiante).
   - Un **acompañante** solo puede consultar/registrar sobre estudiantes que estén en su lista de asignados. Esa relación (acompañante ↔ estudiantes a cargo) es un dato que **vive en el Servicio de Acompañamiento** (o se sincroniza desde el sistema académico) y se valida en cada request, no solo al cargar la lista inicial — porque las asignaciones pueden cambiar.

**Comunicación interna (servicio a servicio).** El frontend nunca habla directo con los sistemas fuente ni con el Servicio de Acompañamiento: todo pasa por el API Gateway/BFF. Entre servicios internos (Gateway → Servicio de Agregación / Acompañamiento → Adaptadores):
- Red segmentada: los servicios internos no son alcanzables desde fuera del perímetro (no exponen puerto público).
- El contexto del usuario autenticado se propaga (p. ej. un JWT interno de corta vida, firmado por el Gateway, con el `sub` y `rol` originales) para que cada servicio pueda re-validar autorización sin tener que volver a preguntarle al IdP.
- Cada **adaptador** hacia un sistema fuente usa una credencial de **mínimo privilegio** (solo lectura, solo los campos que necesita), distinta por sistema, gestionada en un vault de secretos — así, si se compromete el adaptador del LMS, no se compromete el acceso al ERP.

## 3.2 Comunicación

### Escenario A — Estado financiero inmediato

**Decisión: síncrono, sin caché como fuente primaria.** El estudiante "necesita verlo de inmediato", y un estado financiero es información **accionable** (puede haber pagado algo hace una hora): mostrarle un valor desactualizado es peor que hacerlo esperar un segundo de más. Flujo: `Frontend → BFF → Servicio de Agregación → Adaptador ERP → Sistema Financiero`, todo en la misma petición.

Para que esto no sea fràgil ni le pegue directo y sin control al ERP:
- **Timeout corto + circuit breaker** en el adaptador del ERP: si el ERP está lento/caído, no se cuelga toda la pantalla — se falla rápido y esa sección específica muestra un mensaje explícito ("no pudimos obtener tu estado financiero actualizado, intenta de nuevo"), mientras el resto de Vista 360 (académico, personal) sigue funcionando.
- **Caché de rescate, no de reemplazo**: se cachea la última respuesta exitosa por muy poco tiempo (segundos) solo para absorber refrescos repetidos de pantalla, nunca como respuesta "por defecto" cuando el ERP está disponible.

### Escenario B — Cambio de condición académica

**Decisión: asíncrono, por eventos.** Aquí el requisito es distinto: no es una consulta bajo demanda de un usuario, es un cambio de estado que debe **notificar de forma confiable a varios consumidores independientes** (Servicio de Acompañamiento para activar la intervención temprana, el data warehouse, y potencialmente otros procesos como notificaciones). Encadenar eso de forma síncrona ("cuando cambie la condición, llamo uno por uno a cada sistema interesado") acopla al sistema académico con cada consumidor futuro y hace que un consumidor lento tumbe a los demás.

Flujo: el Sistema Académico (o una capa de **CDC** sobre su base de datos, si no se puede modificar directamente — supuesto explícito) publica un evento de dominio `CondicionAcademicaCambiada` al **bus de eventos**. Cada consumidor se suscribe de forma independiente:
- Servicio de Acompañamiento → genera una alerta para intervención temprana.
- Pipeline de ingesta → actualiza el data warehouse.
- Otros procesos (notificaciones) → informan al estudiante/acompañante.

Para que "actuar de forma temprana" sea confiable y no se pierda el evento si algo falla a mitad de camino, se asume un patrón **outbox** (o CDC) en el origen: la publicación del evento es atómica con el cambio de estado, y el bus garantiza *at-least-once delivery* con reintentos por consumidor.
