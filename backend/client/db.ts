import { SQLDatabase } from "encore.dev/storage/sqldb";

export const clientDB = new SQLDatabase("client", {
  migrations: "./migrations",
});