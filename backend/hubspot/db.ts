import { SQLDatabase } from "encore.dev/storage/sqldb";

export const hubspotDB = new SQLDatabase("hubspot", {
  migrations: "./migrations",
});