export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "./data/vista360.sqlite",
  serviceToken: process.env.SERVICE_TOKEN ?? "dev-secret-token",
};
