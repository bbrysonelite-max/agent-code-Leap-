import { SQLDatabase } from "encore.dev/storage/sqldb";

export const salesforceDB = new SQLDatabase("salesforce", {
  migrations: "./migrations",
});