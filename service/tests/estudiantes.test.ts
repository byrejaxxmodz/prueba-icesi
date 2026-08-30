import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type Database from "better-sqlite3";
import { createConnection } from "../src/db/connection";
import { seedDatabase } from "../src/db/seedData";
import { createApp } from "../src/app";
import { config } from "../src/config";

let db: Database.Database;
let app: ReturnType<typeof createApp>;

before(() => {
  db = createConnection(":memory:");
  seedDatabase(db);
  app = createApp(db);
});

after(() => {
  db.close();
});

const SERVICE_TOKEN = config.serviceToken;

test("GET /health responde ok sin autenticación", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
});

test("rechaza sin token de servicio", async () => {
  const res = await request(app).get("/api/v1/estudiantes/1/materias");
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "no_autorizado");
});

test("rechaza con token de servicio inválido", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/1/materias")
    .set("Authorization", "Bearer token-incorrecto")
    .set("X-User-Id", "1")
    .set("X-User-Role", "estudiante");
  assert.equal(res.status, 401);
});

test("rechaza si faltan los encabezados de contexto de usuario", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/1/materias")
    .set("Authorization", `Bearer ${SERVICE_TOKEN}`);
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "contexto_usuario_faltante");
});

test("un estudiante puede consultar su propia información", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/1/materias")
    .set("Authorization", `Bearer ${SERVICE_TOKEN}`)
    .set("X-User-Id", "1")
    .set("X-User-Role", "estudiante");

  assert.equal(res.status, 200);
  assert.equal(res.body.estudiante.codigo, "A00001");
  assert.equal(res.body.materias.length, 2);
  assert.deepEqual(
    res.body.materias.map((m: { codigo: string }) => m.codigo),
    ["ARQ200", "COM101"]
  );
  const com101 = res.body.materias.find((m: { codigo: string }) => m.codigo === "COM101");
  assert.equal(com101.notaActual, 4.2);
  const arq200 = res.body.materias.find((m: { codigo: string }) => m.codigo === "ARQ200");
  assert.equal(arq200.notaActual, null);
});

test("un estudiante NO puede consultar la información de otro estudiante", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/2/materias")
    .set("Authorization", `Bearer ${SERVICE_TOKEN}`)
    .set("X-User-Id", "1")
    .set("X-User-Role", "estudiante");

  assert.equal(res.status, 403);
  assert.equal(res.body.error, "prohibido");
});

test("un acompañante puede consultar cualquier estudiante", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/2/materias")
    .set("Authorization", `Bearer ${SERVICE_TOKEN}`)
    .set("X-User-Id", "999")
    .set("X-User-Role", "acompanante");

  assert.equal(res.status, 200);
  assert.equal(res.body.estudiante.codigo, "A00002");
  assert.equal(res.body.materias.length, 3);
});

test("estudiante sin materias activas devuelve lista vacía", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/3/materias")
    .set("Authorization", `Bearer ${SERVICE_TOKEN}`)
    .set("X-User-Id", "3")
    .set("X-User-Role", "estudiante");

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.materias, []);
});

test("responde 404 si el estudiante no existe", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/9999/materias")
    .set("Authorization", `Bearer ${SERVICE_TOKEN}`)
    .set("X-User-Id", "999")
    .set("X-User-Role", "acompanante");

  assert.equal(res.status, 404);
  assert.equal(res.body.error, "estudiante_no_encontrado");
});

test("responde 400 si el id no es numérico", async () => {
  const res = await request(app)
    .get("/api/v1/estudiantes/abc/materias")
    .set("Authorization", `Bearer ${SERVICE_TOKEN}`)
    .set("X-User-Id", "999")
    .set("X-User-Role", "acompanante");

  assert.equal(res.status, 400);
  assert.equal(res.body.error, "id_invalido");
});
