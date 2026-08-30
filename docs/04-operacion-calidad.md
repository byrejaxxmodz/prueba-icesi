# Parte 4 — Operación y calidad

## Escenario A — Carga intermitente de información académica

**Cómo afrontaría el incidente.** Dado que es intermitente y "no se reproduce con facilidad", intentar reproducirlo manualmente es la vía más lenta. En su lugar:

1. **Reconstruir el camino de una petición fallida real** usando un *trace id* de extremo a extremo (Frontend → BFF → Servicio de Agregación → Adaptador → Sistema Académico), para ver en qué salto exacto y en qué momento falló, en vez de adivinar.
2. **Revisar métricas por dependencia** (tasa de error y latencia del adaptador del sistema académico específicamente, no de Vista 360 en general): un patrón intermitente casi siempre es *timeout bajo carga*, *agotamiento de pool de conexiones*, *rate limiting del sistema legado*, o un *cache stampede* justo cuando expira el TTL en horas pico.
3. **Correlacionar con el tiempo**: ¿coincide con horas de matrícula, con el vencimiento del caché, con un job batch del sistema académico corriendo en paralelo?
4. Con la causa acotada (ej. el sistema académico rechaza conexiones bajo cierta concurrencia), la corrección suele ser aislar el problema (backpressure, más margen de timeout, o degradar solo esa sección) y no un cambio estructural.

**Qué se habría necesitado tener previsto desde el diseño** (la parte que realmente evita el dolor de este incidente):

- **Trazabilidad distribuida** (ej. OpenTelemetry) con un `trace id` que viaje por todos los saltos — sin esto, un fallo intermitente en un sistema con varios saltos es casi imposible de diagnosticar después del hecho.
- **Logging estructurado y centralizado** (no logs sueltos por servicio) con campos consistentes: usuario, rol, sistema destino, latencia, resultado.
- **Métricas y alertas por dependencia externa** (tasa de error/latencia del adaptador de cada sistema fuente), para enterarse por el monitoreo y no porque "los directores reportan".
- **Timeouts explícitos + reintentos con backoff + circuit breaker** en cada adaptador hacia un sistema legado, para que un sistema fuente lento degrade solo su sección en vez de tumbar toda la vista.
- **Degradación parcial por diseño**: si falla el dato académico, el resto de la Vista 360 (personal, financiero) debe seguir mostrándose; nunca todo-o-nada.
- **Health checks / monitoreo sintético** contra cada sistema fuente, independiente del tráfico real de usuarios.

## Escenario B — Reclamo de acceso o alteración indebida

Para poder responderle a un estudiante **con certeza** (no "creemos que no" sino "esto es exactamente lo que pasó"), lo que tiene que existir **desde el diseño**, no agregarse después del reclamo:

- **Auditoría inmutable de acceso y cambios**: cada lectura y cada escritura sobre información de un estudiante queda registrada con quién (identidad validada por el IdP, no un usuario de aplicación), qué recurso, cuándo, desde qué servicio/IP, y si fue permitida o denegada. Un intento denegado también es evidencia y debe quedar registrado.
- **La auditoría se registra en el punto donde se decide la autorización** (Gateway/servicio), no solo como un trigger de base de datos — así se capturan también los intentos que ni siquiera llegaron a tocar la BD.
- **Separación del log de auditoría respecto a la base operativa**: se envía a un almacenamiento distinto, de solo-append (o con hash-chaining), para que no pueda ser editado por las mismas personas que audita.
- **No repudio**: como la identidad viene del IdP institucional (no de una contraseña propia de la app) y los tokens son de corta duración y con alcance limitado, un acceso registrado queda atado de forma confiable a una persona real.
- **Historial de cambios (versionado) sobre los datos sensibles** (reportes, alertas, notas si Vista 360 llegara a tocarlas): quién cambió qué y cuál era el valor anterior — esto es lo que permite responder específicamente a "sospecho que fue *alterada*", no solo "quién la vio".
- **Política de retención** del log de auditoría lo suficientemente larga para cubrir una ventana de reclamo razonable, y revisiones periódicas de acceso.

Con esto, responder al reclamo deja de ser una investigación incierta y se vuelve una consulta directa al log de auditoría para esa fecha y ese estudiante.
