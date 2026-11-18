import { describe, expect, it } from "vitest";
import {
  addHotbarItem,
  EMPTY_HOTBAR,
  HOTBAR_BUNDLE_LIMIT,
  HOTBAR_SLOT_COUNT,
  HOTBAR_STACK_LIMIT,
  hotbarItemCount,
  parseHotbar,
  removeHotbarItem,
} from "./hotbar";

describe("hotbar inventory", () => {
  it("stacks matching items up to eight and uses the next slot afterward", () => {
    let inventory = structuredClone(EMPTY_HOTBAR);
    for (let i = 0; i < HOTBAR_STACK_LIMIT + 1; i++) {
      inventory = addHotbarItem(inventory, "scrap").inventory;
    }

    expect(inventory.slots[0]).toEqual({ item: "scrap", count: HOTBAR_STACK_LIMIT });
    expect(inventory.slots[1]).toEqual({ item: "scrap", count: 1 });
  });

  it("stores overflow in the protected bundle and only replaces it with a rarer pickup", () => {
    let inventory = structuredClone(EMPTY_HOTBAR);
    for (let i = 0; i < HOTBAR_SLOT_COUNT * HOTBAR_STACK_LIMIT - HOTBAR_STACK_LIMIT; i++) {
      inventory = addHotbarItem(inventory, "bone").inventory;
    }
    for (let i = 0; i < HOTBAR_BUNDLE_LIMIT; i++) {
      inventory = addHotbarItem(inventory, "scrap").inventory;
    }

    expect(addHotbarItem(inventory, "scrap").accepted).toBe(false);
    const replacement = addHotbarItem(inventory, "shard");
    expect(replacement.accepted).toBe(true);
    expect(replacement.replaced).toBe("scrap");
    expect(hotbarItemCount(replacement.inventory)).toBe(
      (HOTBAR_SLOT_COUNT - 1) * HOTBAR_STACK_LIMIT + HOTBAR_BUNDLE_LIMIT,
    );
    expect(removeHotbarItem(replacement.inventory, 8).item).toBeNull();
  });

  it("normalizes persisted data to fixed slot and bundle limits", () => {
    const parsed = parseHotbar({
      slots: [{ item: "scrap", count: 100 }, { item: "toString", count: 2 }],
      bundle: [{ item: "bone", count: 100 }],
      selected: 99,
    });

    expect(parsed.slots).toHaveLength(8);
    expect(parsed.slots[0]).toEqual({ item: "scrap", count: HOTBAR_STACK_LIMIT });
    expect(parsed.slots[1]).toBeNull();
    expect(hotbarItemCount(parsed)).toBe(HOTBAR_STACK_LIMIT * 2);
    expect(parsed.selected).toBe(0);
  });
});
