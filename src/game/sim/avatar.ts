export const AVATAR_COLOR_OPTIONS = [
  "#f2c9a5",
  "#d9a276",
  "#c8a77a",
  "#a86f4f",
  "#75442f",
  "#382c2a",
  "#17191b",
  "#a76b38",
  "#d3b04c",
  "#a83245",
  "#51466f",
  "#f06428",
  "#d83a23",
  "#ff8b24",
  "#f2c94c",
  "#e9e5d6",
  "#526b78",
  "#277c77",
  "#287a49",
  "#4d62a5",
  "#9a49bd",
  "#53677a",
  "#34383b",
  "#22272a",
  "#d5b36c",
  "#26333c",
  "#394554",
] as const;

export const AVATAR_SKIN_TONES = [
  "#f2c9a5",
  "#d9a276",
  "#c8a77a",
  "#a86f4f",
  "#75442f",
] as const;

export const AVATAR_HAIR_COLORS = [
  "#382c2a",
  "#17191b",
  "#a76b38",
  "#d3b04c",
  "#a83245",
  "#51466f",
] as const;

export type AvatarColor = (typeof AVATAR_COLOR_OPTIONS)[number];
export type AvatarSkinTone = (typeof AVATAR_SKIN_TONES)[number];
export type AvatarHairColor = (typeof AVATAR_HAIR_COLORS)[number];
export type AvatarColorKey =
  | "headColor"
  | "hairColor"
  | "bodyColor"
  | "feetColor"
  | "bootsColor"
  | "accessoriesColor"
  | "maskColor"
  | "hatColor"
  | "dressColor";

export type AvatarColors = Record<AvatarColorKey, AvatarColor>;

export const DEFAULT_AVATAR_COLORS: AvatarColors = {
  headColor: "#c8a77a",
  hairColor: "#382c2a",
  bodyColor: "#53677a",
  feetColor: "#34383b",
  bootsColor: "#22272a",
  accessoriesColor: "#d5b36c",
  maskColor: "#26333c",
  hatColor: "#394554",
  dressColor: "#53677a",
};

export function isAvatarSkinTone(value: string): value is AvatarSkinTone {
  return AVATAR_SKIN_TONES.some((tone) => tone === value);
}

export function isAvatarHairColor(value: string): value is AvatarHairColor {
  return AVATAR_HAIR_COLORS.some((color) => color === value);
}

export function isAvatarColor(value: string): value is AvatarColor {
  return AVATAR_COLOR_OPTIONS.some((color) => color === value);
}

export function isAvatarColors(value: unknown): value is AvatarColors {
  if (!value || typeof value !== "object") return false;
  const colors = value as Record<string, unknown>;
  const keys = Object.keys(DEFAULT_AVATAR_COLORS);
  return (
    Object.keys(colors).length === keys.length &&
    keys.every((key) => typeof colors[key] === "string" && isAvatarColor(colors[key]))
  );
}

export function randomizeAvatarColors(random: () => number = Math.random): AvatarColors {
  const entries = (Object.keys(DEFAULT_AVATAR_COLORS) as AvatarColorKey[]).map((key) => {
    const value = Math.max(0, Math.min(0.999999999, random()));
    return [key, AVATAR_COLOR_OPTIONS[Math.floor(value * AVATAR_COLOR_OPTIONS.length)]] as const;
  });
  return Object.fromEntries(entries) as AvatarColors;
}
