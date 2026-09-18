import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/campus_radar";

const client = postgres(DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: DATABASE_URL.includes("localhost") ? false : "require",
});

export const db = drizzle(client, { schema });
export { schema };
