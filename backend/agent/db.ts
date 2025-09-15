import { SQLDatabase } from "encore.dev/storage/sqldb";

export const agentDB = new SQLDatabase("nuscan", {
  migrations: "./migrations",
});
