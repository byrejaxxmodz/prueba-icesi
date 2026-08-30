import express, { type Express } from "express";
import type Database from "better-sqlite3";
import { estudiantesRouter } from "./routes/estudiantes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

export function createApp(db: Database.Database): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1/estudiantes", estudiantesRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
