import { EMPTY_HOTBAR, type HotbarInventory } from "./hotbar";

export type MaterialId = "scrap" | "bone" | "essence";

export type LootInventory = {
  materials: Record<MaterialId, number>;
  books: number;
  shards: number;
  crafted: string[];
  enchanted: string[];
  hotbar: HotbarInventory;
};

export const EMPTY_LOOT_INVENTORY: LootInventory = {
  materials: { scrap: 0, bone: 0, essence: 0 },
  books: 0,
  shards: 0,
  crafted: [],
  enchanted: [],
  hotbar: structuredClone(EMPTY_HOTBAR),
};

export const CRAFTING_RECIPES = [
  { id: "scrap-sword", name: "Scrap Sword", fee: 10, materials: { scrap: 3, bone: 1 }, kind: "sword" },
  { id: "ember-sword", name: "Ember Sword", fee: 15, materials: { scrap: 2, essence: 2 }, kind: "sword" },
  { id: "bone-armor", name: "Bone Armor", fee: 20, materials: { bone: 4, scrap: 2 }, kind: "armor" },
] as const;

export const ENCHANTMENTS = [
  { id: "ember", name: "Ember", description: "Adds a burning edge that deals damage over time." },
  { id: "ward", name: "Ward", description: "Grants a protective aura that reduces incoming damage." },
] as const;

export type LootDrop = {
  materials: Partial<Record<MaterialId, number>>;
  book: boolean;
  shard: boolean;
  inventoryFull?: boolean;
};

export function rollDungeonDrop(
  tier: "grunt" | "runner" | "brute" | "enchanter",
  random: () => number = Math.random,
): LootDrop {
  const materials: Partial<Record<MaterialId, number>> = {
    scrap: tier === "brute" ? 2 : 1,
  };
  if (tier === "runner" || tier === "brute") materials.bone = 1;
  if (tier === "enchanter") materials.essence = 2;
  return {
    materials,
    book: tier !== "enchanter" && random() < 0.035,
    shard: tier === "enchanter",
  };
}

export function canCraft(inventory: LootInventory, recipeId: string, credits: number): boolean {
  const recipe = CRAFTING_RECIPES.find((item) => item.id === recipeId);
  if (!recipe || inventory.crafted.includes(recipeId) || credits < recipe.fee) return false;
  return Object.entries(recipe.materials).every(
    ([material, amount]) => inventory.materials[material as MaterialId] >= amount,
  );
}

export function canEnchant(inventory: LootInventory, itemId: string, enchantmentId: string): boolean {
  const itemExists = inventory.crafted.includes(itemId);
  const enchantmentExists = ENCHANTMENTS.some((item) => item.id === enchantmentId);
  return itemExists && enchantmentExists && inventory.books > 0 && inventory.shards > 0 &&
    !inventory.enchanted.includes(`${itemId}:${enchantmentId}`);
}