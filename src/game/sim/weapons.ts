// Pure weapon definitions — no React, no three.js. Consumed by both scene
// code (gun model, firing) and the Armory shop UI.

export type WeaponId =
  | "scout-pistol"
  | "vector-smg"
  | "riot-shotgun"
  | "marksman-rifle"
  | "longbow-sniper";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  price: number; // credits; 0 = free starter
  damage: number; // per pellet/hit
  pellets: number; // shotguns fire several
  rpm: number; // rounds per minute
  mag: number;
  reloadTime: number; // seconds
  spread: number; // radians at hip fire
  auto: boolean;
  scope: boolean; // supports right-click scope
  desc: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  "scout-pistol": {
    id: "scout-pistol",
    name: "Scout Pistol",
    price: 0,
    damage: 34,
    pellets: 1,
    rpm: 320,
    mag: 12,
    reloadTime: 1.1,
    spread: 0.012,
    auto: false,
    scope: false,
    desc: "Reliable sidearm. Never runs out.",
  },
  "vector-smg": {
    id: "vector-smg",
    name: "Vector SMG",
    price: 75,
    damage: 18,
    pellets: 1,
    rpm: 900,
    mag: 30,
    reloadTime: 1.6,
    spread: 0.03,
    auto: true,
    scope: false,
    desc: "Shreds grunts up close. Sprays wide.",
  },
  "riot-shotgun": {
    id: "riot-shotgun",
    name: "Riot Shotgun",
    price: 138,
    damage: 13,
    pellets: 8,
    rpm: 75,
    mag: 6,
    reloadTime: 2.4,
    spread: 0.09,
    auto: false,
    scope: false,
    desc: "One blast clears a doorway.",
  },
  "marksman-rifle": {
    id: "marksman-rifle",
    name: "Marksman Rifle",
    price: 200,
    damage: 70,
    pellets: 1,
    rpm: 150,
    mag: 10,
    reloadTime: 1.8,
    spread: 0.006,
    auto: false,
    scope: false,
    desc: "Semi-auto precision at mid range.",
  },
  "longbow-sniper": {
    id: "longbow-sniper",
    name: "Longbow Sniper",
    price: 300,
    damage: 150,
    pellets: 1,
    rpm: 42,
    mag: 5,
    reloadTime: 2.6,
    spread: 0.02,
    auto: false,
    scope: true,
    desc: "Hold right-click to scope in. One shot, one down.",
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const STARTER_WEAPON: WeaponId = "scout-pistol";

export function isWeaponId(v: string): v is WeaponId {
  return v in WEAPONS;
}

export function damagePerShot(w: WeaponDef): number {
  return w.damage * w.pellets;
}

/** Seconds between two shots. */
export function shotInterval(w: WeaponDef): number {
  return 60 / w.rpm;
}
