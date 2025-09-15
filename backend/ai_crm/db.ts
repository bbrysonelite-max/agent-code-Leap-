import { SQLDatabase } from "encore.dev/storage/sqldb";

export const CRM = new SQLDatabase("ai_crm", {
  migrations: "./migrations",
});