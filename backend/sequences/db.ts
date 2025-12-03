// Sequence Database
// Part of AI Lead OS
import { SQLDatabase } from "encore.dev/storage/sqldb";

export const sequenceDB = new SQLDatabase("sequences", {
  migrations: "./migrations",
});
