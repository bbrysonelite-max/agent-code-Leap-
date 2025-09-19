import { SQLDatabase } from "encore.dev/storage/sqldb";

export const nurturingDB = new SQLDatabase("intelligent_nurturing", {
  migrations: "./migrations",
});