import { config } from "./config";
import { createConnection } from "./db/connection";
import { seedDatabase } from "./db/seedData";
import { createApp } from "./app";

const db = createConnection(config.dbPath);
seedDatabase(db);

const app = createApp(db);

app.listen(config.port, () => {
  console.log(`Servicio Vista360 - materias escuchando en http://localhost:${config.port}`);
});
