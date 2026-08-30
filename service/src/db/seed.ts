import { config } from "../config";
import { createConnection } from "./connection";
import { seedDatabase } from "./seedData";

const db = createConnection(config.dbPath);
seedDatabase(db);
console.log(`Datos de ejemplo insertados en ${config.dbPath}`);
db.close();
