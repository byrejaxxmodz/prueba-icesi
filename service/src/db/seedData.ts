import type Database from "better-sqlite3";

export function seedDatabase(db: Database.Database): void {
  const estudiantesCount = db
    .prepare("SELECT COUNT(*) as n FROM estudiantes")
    .get() as { n: number };
  if (estudiantesCount.n > 0) {
    return; // ya tiene datos, no duplicar
  }

  const insertEstudiante = db.prepare(
    "INSERT INTO estudiantes (codigo, nombre, email) VALUES (?, ?, ?)"
  );
  const insertMateria = db.prepare(
    "INSERT INTO materias (codigo, nombre, creditos) VALUES (?, ?, ?)"
  );
  const insertMatricula = db.prepare(
    `INSERT INTO matriculas (estudiante_id, materia_id, periodo, estado, nota_actual)
     VALUES (?, ?, ?, ?, ?)`
  );

  const seed = db.transaction(() => {
    const estudiantes = [
      insertEstudiante.run("A00001", "Ana Pérez", "ana.perez@icesi.edu.co"),
      insertEstudiante.run("A00002", "Carlos Ríos", "carlos.rios@icesi.edu.co"),
      insertEstudiante.run("A00003", "Luisa Gómez", "luisa.gomez@icesi.edu.co"),
    ];

    const materias = [
      insertMateria.run("COM101", "Computación en Internet II", 3),
      insertMateria.run("ARQ200", "Arquitectura de Software", 4),
      insertMateria.run("BD210", "Bases de Datos II", 3),
      insertMateria.run("MAT150", "Cálculo Multivariado", 4),
      insertMateria.run("ELEC300", "Electiva Profesional UX", 2),
    ];

    const periodoActual = "2026-2";
    const periodoAnterior = "2026-1";

    // Ana (1): dos materias activas del periodo actual, una nota ya cargada y otra pendiente
    insertMatricula.run(estudiantes[0].lastInsertRowid, materias[0].lastInsertRowid, periodoActual, "activa", 4.2);
    insertMatricula.run(estudiantes[0].lastInsertRowid, materias[1].lastInsertRowid, periodoActual, "activa", null);
    insertMatricula.run(estudiantes[0].lastInsertRowid, materias[3].lastInsertRowid, periodoAnterior, "aprobada", 3.8);

    // Carlos (2): tres materias activas del periodo actual
    insertMatricula.run(estudiantes[1].lastInsertRowid, materias[1].lastInsertRowid, periodoActual, "activa", 3.5);
    insertMatricula.run(estudiantes[1].lastInsertRowid, materias[2].lastInsertRowid, periodoActual, "activa", 4.7);
    insertMatricula.run(estudiantes[1].lastInsertRowid, materias[4].lastInsertRowid, periodoActual, "activa", null);

    // Luisa (3): no tiene materias activas este periodo (todo finalizado) -> caso de lista vacía
    insertMatricula.run(estudiantes[2].lastInsertRowid, materias[2].lastInsertRowid, periodoAnterior, "aprobada", 4.0);
    insertMatricula.run(estudiantes[2].lastInsertRowid, materias[3].lastInsertRowid, periodoAnterior, "retirada", null);
  });

  seed();
}
