export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS estudiantes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo   TEXT NOT NULL UNIQUE,
  nombre   TEXT NOT NULL,
  email    TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS materias (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo    TEXT NOT NULL UNIQUE,
  nombre    TEXT NOT NULL,
  creditos  INTEGER NOT NULL CHECK (creditos > 0)
);

CREATE TABLE IF NOT EXISTS matriculas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  estudiante_id    INTEGER NOT NULL REFERENCES estudiantes(id),
  materia_id       INTEGER NOT NULL REFERENCES materias(id),
  periodo          TEXT NOT NULL,
  estado           TEXT NOT NULL CHECK (estado IN ('activa', 'aprobada', 'reprobada', 'retirada')),
  nota_actual      REAL CHECK (nota_actual IS NULL OR (nota_actual >= 0 AND nota_actual <= 5)),
  fecha_matricula  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(estudiante_id, materia_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_matriculas_estudiante ON matriculas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_estado ON matriculas(estado);
`;
