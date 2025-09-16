import { SQLDatabase } from "encore.dev/storage/sqldb";

export const performanceDB = new SQLDatabase("db_performance", {
  migrations: "./migrations",
});