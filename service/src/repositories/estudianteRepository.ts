import type Database from "better-sqlite3";
import type { EstudianteRow, MateriaActualRow } from "../types";

export class EstudianteRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: number): EstudianteRow | undefined {
    return this.db
      .prepare("SELECT id, codigo, nombre, email FROM estudiantes WHERE id = ?")
      .get(id) as EstudianteRow | undefined;
  }

  findMateriasActuales(estudianteId: number): MateriaActualRow[] {
    return this.db
      .prepare(
        `SELECT
           m.id AS materiaId,
           m.codigo AS codigo,
           m.nombre AS nombre,
           m.creditos AS creditos,
           mt.periodo AS periodo,
           mt.estado AS estado,
           mt.nota_actual AS notaActual
         FROM matriculas mt
         JOIN materias m ON m.id = mt.materia_id
         WHERE mt.estudiante_id = ? AND mt.estado = 'activa'
         ORDER BY m.codigo`
      )
      .all(estudianteId) as MateriaActualRow[];
  }
}
