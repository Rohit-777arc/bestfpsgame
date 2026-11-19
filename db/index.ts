import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema";

function createDatabase() {
  return drizzle({ schema });
}
let database: ReturnType<typeof createDatabase> | undefined;
export function getEconomyDatabase() {
  return (database ??= createDatabase());
}
