# Servicio — Materias y notas actuales del estudiante (Parte 2)

Dado el identificador de un estudiante, devuelve sus materias matriculadas y la nota actual de cada una. Es una implementación propia y simplificada; en la arquitectura de la Parte 1 este servicio representa lo que expondría el **Sistema Académico (SIS)**, consumido por el Servicio de Agregación de Vista 360 a través de un adaptador.

## Stack

Node.js + TypeScript + Express + SQLite (`better-sqlite3`). Se eligió por ser rápido de levantar y correr sin dependencias externas (no requiere instalar un motor de base de datos aparte) — la elección de stack no penaliza según el enunciado, así que se priorizó facilidad de revisión.

## Cómo correrlo

```bash
npm install
npm run seed   # crea data/vista360.sqlite con datos de ejemplo
npm run dev    # http://localhost:3000
```

Variables de entorno (ver `.env.example`): `PORT`, `DB_PATH`, `SERVICE_TOKEN`.

Otros comandos:

```bash
npm test       # 10 pruebas de integración (node:test + supertest, DB en memoria)
npm run build  # compila a dist/
npm start      # corre el build compilado
```

## Especificación del servicio

### `GET /api/v1/estudiantes/:id/materias`

**Qué recibe:** el identificador numérico del estudiante en la URL.

**Autenticación/autorización** (ver también [`../docs/03-seguridad-comunicacion.md`](../docs/03-seguridad-comunicacion.md)): este servicio nunca lo llama el frontend directamente, sino el API Gateway/BFF ya autenticado. Se simula ese contrato con dos encabezados adicionales al token de servicio:

| Encabezado | Para qué |
|---|---|
| `Authorization: Bearer <SERVICE_TOKEN>` | identifica que la llamada viene del Gateway/BFF de confianza |
| `X-User-Id` | id del usuario ya autenticado por el IdP (el Gateway lo reenvía tras validar el JWT) |
| `X-User-Role` | `estudiante` o `acompanante` |

Reglas de autorización aplicadas: un `estudiante` solo puede consultar `:id == X-User-Id` (403 si no coincide); un `acompanante` puede consultar cualquier estudiante en este servicio — la verificación de "estudiantes a su cargo" vive en el Servicio de Acompañamiento, no aquí (ver Parte 1).

**Ejemplo de request:**

```bash
curl http://localhost:3000/api/v1/estudiantes/1/materias \
  -H "Authorization: Bearer dev-secret-token" \
  -H "X-User-Id: 1" \
  -H "X-User-Role: estudiante"
```

**Respuesta 200:**

```json
{
  "estudiante": { "id": 1, "codigo": "A00001", "nombre": "Ana Pérez" },
  "materias": [
    { "materiaId": 1, "codigo": "COM101", "nombre": "Computación en Internet II", "creditos": 3, "periodo": "2026-2", "estado": "activa", "notaActual": 4.2 },
    { "materiaId": 2, "codigo": "ARQ200", "nombre": "Arquitectura de Software", "creditos": 4, "periodo": "2026-2", "estado": "activa", "notaActual": null }
  ]
}
```

`notaActual: null` significa que la materia está matriculada y activa pero aún no tiene nota cargada (caso normal a mitad de semestre).

**Errores:**

| Código | `error` | Cuándo |
|---|---|---|
| 400 | `id_invalido` | el `:id` no es un entero positivo |
| 401 | `no_autorizado` / `contexto_usuario_faltante` | falta o es inválido el token de servicio o el contexto de usuario |
| 403 | `prohibido` | un estudiante intenta consultar información de otro estudiante |
| 404 | `estudiante_no_encontrado` | no existe un estudiante con ese id |

### `GET /health`

Chequeo de salud, sin autenticación. `200 { "status": "ok" }`.

## Diseño de la base de datos

Tres tablas (`src/db/schema.ts`):

- **`estudiantes`** (`id`, `codigo`, `nombre`, `email`) — identidad básica del estudiante.
- **`materias`** (`id`, `codigo`, `nombre`, `creditos`) — catálogo de materias, independiente del tiempo.
- **`matriculas`** (`id`, `estudiante_id`, `materia_id`, `periodo`, `estado`, `nota_actual`, `fecha_matricula`) — la tabla central: relaciona un estudiante con una materia **en un periodo académico**, con su estado (`activa`, `aprobada`, `reprobada`, `retirada`) y su nota actual.

**Por qué una sola tabla de matrícula y no separar "matrícula" de "nota" en dos tablas:** el enunciado pide "materias matriculadas" y "notas de las materias inscritas actualmente" como el mismo conjunto de información (una matrícula activa *es* la fuente de la nota actual); separarlas hubiera significado sincronizar dos tablas para un dato que cambia junto. `estado = 'activa'` es exactamente lo que el servicio filtra para responder "inscritas actualmente".

`nota_actual` es nullable porque una materia puede estar matriculada y activa sin tener nota todavía (parciales aún no calificados) — el contrato del servicio refleja eso explícitamente en vez de inventar un `0`.

## Qué se implementó y qué se dejó fuera (alcance)

**Implementado:** contrato del servicio, modelo de datos, autorización por rol y por dueño del dato, manejo de errores (400/401/403/404), datos de ejemplo, y pruebas de integración cubriendo los casos anteriores.

**Dejado fuera deliberadamente**, por ser "sencillo" y no ser el foco de esta parte de la prueba (si se necesitara, así se abordaría):

- Validación real de JWT/OIDC contra un IdP — se simula con encabezados (ver arriba); la Parte 3 sí describe cómo sería con el IdP real.
- Migraciones versionadas (`schema.ts` usa `CREATE TABLE IF NOT EXISTS`, suficiente para este alcance).
- Paginación — el volumen de materias por estudiante por periodo es pequeño por naturaleza.
- Rate limiting / circuit breaker hacia la BD — no aplica porque aquí la BD es propia, no un sistema legado (ese patrón se describe en la Parte 1/4 para las llamadas a sistemas fuente reales).
