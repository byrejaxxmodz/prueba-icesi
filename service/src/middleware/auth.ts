import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import type { Rol } from "../types";

const ROLES_VALIDOS: Rol[] = ["estudiante", "acompanante"];

/**
 * Simulación simplificada del perímetro descrito en la Parte 3 (seguridad):
 * en la arquitectura real, el API Gateway/BFF valida el JWT emitido por el
 * IdP institucional y reenvía el contexto del usuario (id, rol) a este
 * servicio interno junto con un token de servicio propio. Aquí se simula
 * ese contrato con dos elementos:
 *   - Authorization: Bearer <SERVICE_TOKEN>  -> identifica al llamador (el Gateway)
 *   - X-User-Id / X-User-Role                -> contexto del usuario ya autenticado
 */
export function requireServiceAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || token !== config.serviceToken) {
    res.status(401).json({
      error: "no_autorizado",
      message: "token de servicio inválido o ausente",
    });
    return;
  }

  const userId = req.header("x-user-id");
  const userRole = req.header("x-user-role") as Rol | undefined;

  if (!userId || !userRole || !ROLES_VALIDOS.includes(userRole)) {
    res.status(401).json({
      error: "contexto_usuario_faltante",
      message: "faltan o son inválidos los encabezados X-User-Id / X-User-Role",
    });
    return;
  }

  req.userContext = { id: userId, rol: userRole };
  next();
}

/**
 * Autorización a nivel de registro (Parte 3): un estudiante solo puede
 * consultar su propia información. Un acompañante puede consultar
 * cualquier estudiante en este servicio simplificado; en la arquitectura
 * real esa verificación de "estudiantes a cargo" la resuelve el Servicio
 * de Acompañamiento (ver docs/01-arquitectura.md), no este servicio académico.
 */
export function requireOwnStudentOrAcompanante(req: Request, res: Response, next: NextFunction): void {
  const { id: estudianteIdParam } = req.params;
  const user = req.userContext;

  if (!user) {
    res.status(401).json({ error: "no_autorizado" });
    return;
  }

  if (user.rol === "estudiante" && user.id !== estudianteIdParam) {
    res.status(403).json({
      error: "prohibido",
      message: "un estudiante solo puede consultar su propia información",
    });
    return;
  }

  next();
}
