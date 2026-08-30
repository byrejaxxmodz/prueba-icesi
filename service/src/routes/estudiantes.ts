import { Router } from "express";
import type Database from "better-sqlite3";
import { EstudianteRepository } from "../repositories/estudianteRepository";
import { requireServiceAuth, requireOwnStudentOrAcompanante } from "../middleware/auth";

export function estudiantesRouter(db: Database.Database): Router {
  const router = Router();
  const repo = new EstudianteRepository(db);

  router.get(
    "/:id/materias",
    requireServiceAuth,
    requireOwnStudentOrAcompanante,
    (req, res) => {
      const idParam = req.params.id;

      if (typeof idParam !== "string" || !/^\d+$/.test(idParam)) {
        res.status(400).json({
          error: "id_invalido",
          message: "el identificador del estudiante debe ser un entero positivo",
        });
        return;
      }

      const estudianteId = Number(idParam);
      const estudiante = repo.findById(estudianteId);

      if (!estudiante) {
        res.status(404).json({
          error: "estudiante_no_encontrado",
          message: `no existe un estudiante con id ${estudianteId}`,
        });
        return;
      }

      const materias = repo.findMateriasActuales(estudianteId);

      res.status(200).json({
        estudiante: {
          id: estudiante.id,
          codigo: estudiante.codigo,
          nombre: estudiante.nombre,
        },
        materias: materias.map((m) => ({
          materiaId: m.materiaId,
          codigo: m.codigo,
          nombre: m.nombre,
          creditos: m.creditos,
          periodo: m.periodo,
          estado: m.estado,
          notaActual: m.notaActual,
        })),
      });
    }
  );

  return router;
}
