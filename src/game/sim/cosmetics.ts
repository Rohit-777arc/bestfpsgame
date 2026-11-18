export type CosmeticSlot = "shirt" | "hat" | "pants" | "boots";

export interface Cosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  price: number;
  color: string;
  style:
    | "shirt"
    | "vest"
    | "coat"
    | "cap"
    | "helmet"
    | "jacket"
    | "armor"
    | "hoodie"
    | "champion"
    | "cloak";
}

export const COSMETICS = [
  {
    id: "field-shirt",
    name: "Field Shirt",
    slot: "shirt",
    price: 40,
    color: "#5e9d72",
    style: "shirt",
  },
  {
    id: "urban-vest",
    name: "Urban Vest",
    slot: "shirt",
    price: 75,
    color: "#718399",
    style: "vest",
  },
  {
    id: "desert-coat",
    name: "Desert Coat",
    slot: "shirt",
    price: 100,
    color: "#bc8955",
    style: "coat",
  },
  {
    id: "neon-jacket",
    name: "Neon Cyber Jacket",
    slot: "shirt",
    price: 140,
    color: "#18b9ad",
    style: "jacket",
  },
  {
    id: "dungeon-armor",
    name: "Dungeon Knight Armor",
    slot: "shirt",
    price: 180,
    color: "#667887",
    style: "armor",
  },
  {
    id: "crimson-hoodie",
    name: "Crimson Hoodie",
    slot: "shirt",
    price: 125,
    color: "#a83245",
    style: "hoodie",
  },
  {
    id: "gold-champion",
    name: "Gold Champion Shirt",
    slot: "shirt",
    price: 220,
    color: "#d2a638",
    style: "champion",
  },
  {
    id: "shadow-cloak",
    name: "Shadow Cloak",
    slot: "shirt",
    price: 260,
    color: "#51466f",
    style: "cloak",
  },
  { id: "scout-cap", name: "Scout Cap", slot: "hat", price: 35, color: "#485b45", style: "cap" },
  {
    id: "combat-helmet",
    name: "Combat Helmet",
    slot: "hat",
    price: 80,
    color: "#889276",
    style: "helmet",
  },
  { id: "field-trousers", name: "Field Trousers", slot: "pants", price: 45, color: "#454b43", style: "shirt" },
  { id: "dungeon-greaves", name: "Dungeon Greaves", slot: "pants", price: 110, color: "#667887", style: "armor" },
  { id: "combat-boots", name: "Combat Boots", slot: "boots", price: 35, color: "#332a22", style: "shirt" },
  { id: "iron-greaves", name: "Iron Boots", slot: "boots", price: 85, color: "#68747b", style: "armor" },
] as const satisfies readonly Cosmetic[];

export type CosmeticId = (typeof COSMETICS)[number]["id"];

export const COSMETIC_IDS: CosmeticId[] = COSMETICS.map((item) => item.id);

export function isCosmeticId(id: string): id is CosmeticId {
  return COSMETIC_IDS.includes(id as CosmeticId);
}

export function getCosmetic(id: string | null): Cosmetic | undefined {
  return COSMETICS.find((item) => item.id === id);
}
