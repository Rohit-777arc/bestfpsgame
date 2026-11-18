export const WEAPON_SKIN_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "secret",
] as const;

export type WeaponSkinRarity = (typeof WEAPON_SKIN_RARITIES)[number];

export const WEAPON_SKINS = [
  { id: "field-worn", name: "Field Worn", rarity: "common", color: "#87907d" },
  { id: "dust-runner", name: "Dust Runner", rarity: "common", color: "#b78b58" },
  { id: "night-watch", name: "Night Watch", rarity: "common", color: "#4b5c69" },
  { id: "mint-condition", name: "Mint Condition", rarity: "uncommon", color: "#73bf9b" },
  { id: "blueprint", name: "Blueprint", rarity: "uncommon", color: "#4e9fdb" },
  { id: "sunset-camo", name: "Sunset Camo", rarity: "uncommon", color: "#db7652" },
  { id: "arctic-ops", name: "Arctic Ops", rarity: "rare", color: "#a9d8e8" },
  { id: "toxic-grid", name: "Toxic Grid", rarity: "rare", color: "#81d62d" },
  { id: "royal-steel", name: "Royal Steel", rarity: "rare", color: "#8873d8" },
  { id: "solar-flare", name: "Solar Flare", rarity: "epic", color: "#f3a83b" },
  { id: "neon-pulse", name: "Neon Pulse", rarity: "epic", color: "#f34bcb" },
  { id: "deep-sea", name: "Deep Sea", rarity: "epic", color: "#316cc5" },
  { id: "gold-standard", name: "Gold Standard", rarity: "legendary", color: "#f2cb48" },
  { id: "dragon-glass", name: "Dragon Glass", rarity: "legendary", color: "#cf4c59" },
  { id: "starlight", name: "Starlight", rarity: "legendary", color: "#c4a4ff" },
  { id: "void-born", name: "Void Born", rarity: "mythic", color: "#aa54ff" },
  { id: "prism-break", name: "Prism Break", rarity: "mythic", color: "#54e2df" },
  { id: "ultraviolet", name: "Ultraviolet", rarity: "mythic", color: "#7739ca" },
  { id: "glitch-prototype", name: "Glitch Prototype", rarity: "secret", color: "#ff3b76" },
  { id: "ghost-code", name: "Ghost Code", rarity: "secret", color: "#d8fffb" },
  { id: "zero-day", name: "Zero Day", rarity: "secret", color: "#24242a" },
] as const satisfies readonly {
  id: string;
  name: string;
  rarity: WeaponSkinRarity;
  color: string;
}[];

export type WeaponSkinId = (typeof WEAPON_SKINS)[number]["id"];

export const WEAPON_CRATES = WEAPON_SKIN_RARITIES.map((rarity, index) => ({
  rarity,
  price: [100, 250, 500, 900, 1_500, 2_500, 4_000][index],
}));

export const LOTTERY_PRICE = 100;
export const LOTTERY_PRIZES = [
  { amount: 0, chance: 0.35 },
  { amount: 50, chance: 0.35 },
  { amount: 100, chance: 0.18 },
  { amount: 250, chance: 0.09 },
  { amount: 1_000, chance: 0.03 },
] as const;

export function isWeaponSkinId(id: string): id is WeaponSkinId {
  return WEAPON_SKINS.some((skin) => skin.id === id);
}

export function getWeaponSkin(id: string | null): (typeof WEAPON_SKINS)[number] | undefined {
  return WEAPON_SKINS.find((skin) => skin.id === id);
}

export function isWeaponSkinRarity(value: string): value is WeaponSkinRarity {
  return WEAPON_SKIN_RARITIES.some((rarity) => rarity === value);
}

export function rollWeaponSkin(
  rarity: WeaponSkinRarity,
  random: () => number = Math.random,
  ownedSkins: readonly string[] = [],
): WeaponSkinId {
  const skins = WEAPON_SKINS.filter(
    (skin) => skin.rarity === rarity && !ownedSkins.includes(skin.id),
  );
  const index = Math.min(skins.length - 1, Math.floor(random() * skins.length));
  const skin = skins[index];
  if (!skin) throw new Error(`No weapon skins available for ${rarity}`);
  return skin.id;
}

export function rollLottery(random: () => number = Math.random): number {
  const value = Math.max(0, Math.min(0.999999999, random()));
  let threshold = 0;
  for (const prize of LOTTERY_PRIZES) {
    threshold += prize.chance;
    if (value < threshold) return prize.amount;
  }
  return LOTTERY_PRIZES[LOTTERY_PRIZES.length - 1]?.amount ?? 0;
}
