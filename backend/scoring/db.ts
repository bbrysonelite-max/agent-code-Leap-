import { SQLDatabase } from "encore.dev/storage/sqldb";

export const db = new SQLDatabase("scoring_db", {
  migrations: "./migrations",
});