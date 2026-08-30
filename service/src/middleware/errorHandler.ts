import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "ruta_no_encontrada", message: `${req.method} ${req.path} no existe` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  console.error(err);
  res.status(500).json({ error: "error_interno", message: "ocurrió un error inesperado" });
}
