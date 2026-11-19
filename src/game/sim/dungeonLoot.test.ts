import { describe, expect, it } from "vitest";
import {
  canCraft,
  canEnchant,
  EMPTY_LOOT_INVENTORY,
  rollDungeonDrop,
} from "./dungeonLoot";

describe("dungeon loot", () => {
  it("drops crafting materials and guarantees the enchanter shard", () => {
    expect(rollDungeonDrop("brute", () => 1).materials).toEqual({ scrap: 2, bone: 1 });
    expect(rollDungeonDrop("enchanter")).toMatchObject({
      materials: { scrap: 1, essence: 2 },
      shard: true,
    });
  });

  it("only allows crafting and enchanting when their requirements are owned", () => {
    const inventory = {
      ...EMPTY_LOOT_INVENTORY,
      materials: { scrap: 3, bone: 1, essence: 0 },
      books: 1,
      shards: 1,
    };
    expect(canCraft(inventory, "scrap-sword", 13)).toBe(true);
    expect(canCraft(inventory, "scrap-sword", 12)).toBe(false);
    expect(canEnchant({ ...inventory, crafted: ["scrap-sword"] }, "scrap-sword", "ember")).toBe(true);
    expect(canEnchant(inventory, "bone-armor", "ember")).toBe(false);
  });
});
