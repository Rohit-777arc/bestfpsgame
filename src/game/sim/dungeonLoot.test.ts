import { describe, expect, it } from "vitest";
import {
  canCraft,
  canEnchant,
  EMPTY_LOOT_INVENTORY,
  rollDungeonDrop,
  ENEMY_BOOK_CHANCE,
} from "./dungeonLoot";

describe("dungeon loot", () => {
  it("drops crafting materials and guarantees the enchanter shard", () => {
    expect(rollDungeonDrop("brute", () => 1).materials).toEqual({ scrap: 2, bone: 1 });
    expect(rollDungeonDrop("enchanter")).toMatchObject({
      materials: { scrap: 1, essence: 2 },
      shard: true,
    });
  });

  it("makes books a rare chance rather than a guaranteed wave reward", () => {
    expect(rollDungeonDrop("grunt", () => ENEMY_BOOK_CHANCE / 2).book).toBe(true);
    expect(rollDungeonDrop("grunt", () => ENEMY_BOOK_CHANCE).book).toBe(false);
    expect(rollDungeonDrop("brute", () => .5).book).toBe(false);
    expect(rollDungeonDrop("enchanter", () => 0).book).toBe(false);
    expect(ENEMY_BOOK_CHANCE).toBeLessThan(.01);
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
