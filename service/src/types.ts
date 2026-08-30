export type Rol = "estudiante" | "acompanante";

export interface UserContext {
  id: string;
  rol: Rol;
}

export interface EstudianteRow {
  id: number;
  codigo: string;
  nombre: string;
  email: string;
}

export interface MateriaActualRow {
  materiaId: number;
  codigo: string;
  nombre: string;
  creditos: number;
  periodo: string;
  estado: string;
  notaActual: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}
