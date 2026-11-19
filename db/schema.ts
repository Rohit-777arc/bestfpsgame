import { pgTable, text, jsonb } from "drizzle-orm/pg-core";
import type { EconomyState } from "../src/game/sim/economy";

export const playerEconomies = pgTable("player_economies", {
  playerId: text("player_id").primaryKey(),
  progress: jsonb("progress").$type<EconomyState>().notNull(),
});
