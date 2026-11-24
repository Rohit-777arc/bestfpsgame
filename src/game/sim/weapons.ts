// Pure weapon definitions — no React, no three.js. Consumed by both scene
// code (gun model, firing) and the Armory shop UI.

export type WeaponId =
  // Original Mexican Standof arsenal
  | "scout-pistol"
  | "vector-smg"
  | "riot-shotgun"
  | "marksman-rifle"
  | "longbow-sniper"
  // Blaster arsenal brought over from Dead Center
  | "cube-smg"
  | "ak-47"
  | "brick-pump"
  | "long-block"
  | "boom-tube"
  | "frost-ray"
  | "blaze-hose"
  | "gatling"
  | "confetti-cannon"
  | "blocky-p9"
  | "brick-revolver"
  | "buzz-pistol"
  | "flare-gun";

export type WeaponSlot = "primary" | "sidearm";
export type WeaponEffect = "burn" | "freeze";
export type WeaponCollection = "standof" | "blasters";
export type WeaponModelKind =
  | "pistol"
  | "revolver"
  | "smg"
  | "rifle"
  | "shotgun"
  | "sniper"
  | "launcher"
  | "ray"
  | "flamer"
  | "gatling"
  | "party";

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
  slot: WeaponSlot;
  collection: WeaponCollection;
  /** Max bullet travel in metres (flamethrowers are short). Defaults to 160. */
  range?: number;
  /** Splash radius in metres; damage falls off from the centre. */
  aoe?: number;
  /** Status effect applied on hit. */
  effect?: WeaponEffect;
  /** Extra damage up close: full `mult` within `near`, fading to 1 at `far`. */
  closeBonus?: { mult: number; near: number; far: number };
  model: { kind: WeaponModelKind; length: number; color: string };
}

const fromDelay = (fireDelay: number) => Math.round(60 / fireDelay);

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  "scout-pistol": {
    id: "scout-pistol", name: "Scout Pistol", price: 0,
    damage: 34, pellets: 1, rpm: 320, mag: 12, reloadTime: 1.1, spread: 0.012,
    auto: false, scope: false, desc: "Reliable sidearm. Never runs out.",
    slot: "sidearm", collection: "standof",
    model: { kind: "pistol", length: 0.28, color: "#3a3d40" },
  },
  "vector-smg": {
    id: "vector-smg", name: "Vector SMG", price: 75,
    damage: 18, pellets: 1, rpm: 900, mag: 30, reloadTime: 1.6, spread: 0.03,
    auto: true, scope: false, desc: "Shreds grunts up close. Sprays wide.",
    slot: "primary", collection: "standof",
    model: { kind: "smg", length: 0.4, color: "#2a2d33" },
  },
  "riot-shotgun": {
    id: "riot-shotgun", name: "Riot Shotgun", price: 138,
    damage: 13, pellets: 8, rpm: 75, mag: 6, reloadTime: 2.4, spread: 0.09,
    auto: false, scope: false, desc: "One blast clears a doorway.",
    slot: "primary", collection: "standof",
    model: { kind: "shotgun", length: 0.55, color: "#5a3a22" },
  },
  "marksman-rifle": {
    id: "marksman-rifle", name: "Marksman Rifle", price: 200,
    damage: 70, pellets: 1, rpm: 150, mag: 10, reloadTime: 1.8, spread: 0.006,
    auto: false, scope: false, desc: "Semi-auto precision at mid range.",
    slot: "primary", collection: "standof",
    model: { kind: "rifle", length: 0.62, color: "#3a3d40" },
  },
  "longbow-sniper": {
    id: "longbow-sniper", name: "Longbow Sniper", price: 300,
    damage: 150, pellets: 1, rpm: 42, mag: 5, reloadTime: 2.6, spread: 0.02,
    auto: false, scope: true, desc: "Hold right-click to scope in. One shot, one down.",
    slot: "primary", collection: "standof",
    model: { kind: "sniper", length: 0.75, color: "#3b4a33" },
  },

  // ---- Blaster arsenal ----
  "cube-smg": {
    id: "cube-smg", name: "Cube SMG", price: 90,
    damage: 13, pellets: 1, rpm: fromDelay(0.075), mag: 30, reloadTime: 1.2, spread: 0.028,
    auto: true, scope: false, desc: "Shreds up close — more than double damage point-blank.",
    slot: "primary", collection: "blasters",
    closeBonus: { mult: 2.2, near: 6, far: 16 },
    model: { kind: "smg", length: 0.38, color: "#3d6fd1" },
  },
  "ak-47": {
    id: "ak-47", name: "AK-47", price: 175,
    damage: 24, pellets: 1, rpm: fromDelay(0.11), mag: 30, reloadTime: 1.6, spread: 0.018,
    auto: true, scope: false, desc: "Strong full-auto rifle.",
    slot: "primary", collection: "blasters",
    model: { kind: "rifle", length: 0.66, color: "#7a4b25" },
  },
  "brick-pump": {
    id: "brick-pump", name: "Brick Pump", price: 150,
    damage: 18, pellets: 7, rpm: fromDelay(0.8), mag: 6, reloadTime: 1.5, spread: 0.07,
    auto: false, scope: false, desc: "Huge close-range blast.",
    slot: "primary", collection: "blasters",
    model: { kind: "shotgun", length: 0.58, color: "#b8472d" },
  },
  "long-block": {
    id: "long-block", name: "Long Block", price: 320,
    damage: 108, pellets: 1, rpm: fromDelay(1.15), mag: 4, reloadTime: 1.8, spread: 0.004,
    auto: false, scope: true, desc: "One-shot power. Right-click to scope.",
    slot: "primary", collection: "blasters",
    model: { kind: "sniper", length: 0.8, color: "#2f3a52" },
  },
  "boom-tube": {
    id: "boom-tube", name: "Boom Tube", price: 450,
    damage: 140, pellets: 1, rpm: fromDelay(1.4), mag: 1, reloadTime: 2.2, spread: 0,
    auto: false, scope: false, desc: "Rocket with a big splash. Hits everything near the blast.",
    slot: "primary", collection: "blasters",
    aoe: 3.2,
    model: { kind: "launcher", length: 0.8, color: "#4f6b2e" },
  },
  "frost-ray": {
    id: "frost-ray", name: "Frost Ray", price: 260,
    damage: 11, pellets: 1, rpm: fromDelay(0.1), mag: 40, reloadTime: 1.6, spread: 0.01,
    auto: true, scope: false, desc: "Freezing beam. Slows whatever it hits.",
    slot: "primary", collection: "blasters",
    effect: "freeze",
    model: { kind: "ray", length: 0.5, color: "#5fc8ff" },
  },
  "blaze-hose": {
    id: "blaze-hose", name: "Blaze Hose", price: 280,
    damage: 5, pellets: 1, rpm: fromDelay(0.08), mag: 80, reloadTime: 2.2, spread: 0.045,
    auto: true, scope: false, desc: "Short range flamethrower. Sets targets on fire.",
    slot: "primary", collection: "blasters",
    effect: "burn", range: 9,
    model: { kind: "flamer", length: 0.55, color: "#c7512a" },
  },
  gatling: {
    id: "gatling", name: "Gatling", price: 400,
    damage: 6, pellets: 3, rpm: fromDelay(0.04), mag: 150, reloadTime: 3.2, spread: 0.012,
    auto: true, scope: false, desc: "Three tight bullets per shot. Huge belt, long reload.",
    slot: "primary", collection: "blasters",
    model: { kind: "gatling", length: 0.7, color: "#4a4d52" },
  },
  "confetti-cannon": {
    id: "confetti-cannon", name: "Confetti Cannon", price: 25,
    damage: 0, pellets: 1, rpm: fromDelay(0.09), mag: 999, reloadTime: 0.5, spread: 0.06,
    auto: true, scope: false, desc: "Endless party. Does zero damage.",
    slot: "primary", collection: "blasters",
    range: 12,
    model: { kind: "party", length: 0.5, color: "#ff5fb0" },
  },
  "blocky-p9": {
    id: "blocky-p9", name: "Blocky P9", price: 40,
    damage: 34, pellets: 1, rpm: fromDelay(0.26), mag: 10, reloadTime: 0.9, spread: 0.004,
    auto: false, scope: false, desc: "Accurate blocky sidearm.",
    slot: "sidearm", collection: "blasters",
    model: { kind: "pistol", length: 0.3, color: "#d1a02c" },
  },
  "brick-revolver": {
    id: "brick-revolver", name: "Brick Revolver", price: 120,
    damage: 58, pellets: 1, rpm: fromDelay(0.55), mag: 6, reloadTime: 1.5, spread: 0.002,
    auto: false, scope: false, desc: "Six heavy rounds. Slow but hits hard.",
    slot: "sidearm", collection: "blasters",
    model: { kind: "revolver", length: 0.34, color: "#8a3b2a" },
  },
  "buzz-pistol": {
    id: "buzz-pistol", name: "Buzz Pistol", price: 110,
    damage: 10, pellets: 1, rpm: fromDelay(0.065), mag: 20, reloadTime: 1.1, spread: 0.03,
    auto: true, scope: false, desc: "Full-auto machine pistol. Best up close.",
    slot: "sidearm", collection: "blasters",
    closeBonus: { mult: 1.7, near: 5, far: 14 },
    model: { kind: "smg", length: 0.3, color: "#e0c341" },
  },
  "flare-gun": {
    id: "flare-gun", name: "Flare Gun", price: 95,
    damage: 30, pellets: 1, rpm: fromDelay(0.5), mag: 1, reloadTime: 1.1, spread: 0.003,
    auto: false, scope: false, desc: "One glowing shot that sets targets on fire.",
    slot: "sidearm", collection: "blasters",
    effect: "burn", range: 60,
    model: { kind: "pistol", length: 0.32, color: "#ff7a1a" },
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

export const DEFAULT_RANGE = 160;
export const BURN_DPS = 14;
export const BURN_SECONDS = 3;
export const FREEZE_SLOW = 0.4; // enemies move at 40% speed
export const FREEZE_SECONDS = 2;

export function weaponRange(w: WeaponDef): number {
  return w.range ?? DEFAULT_RANGE;
}

/** Damage multiplier from close-range bonus at a given distance (metres). */
export function closeRangeMultiplier(w: WeaponDef, distance: number): number {
  const b = w.closeBonus;
  if (!b) return 1;
  if (distance <= b.near) return b.mult;
  if (distance >= b.far) return 1;
  const t = (distance - b.near) / (b.far - b.near);
  return b.mult + (1 - b.mult) * t;
}

/** Splash damage at a distance from the blast; 0 outside the radius. */
export function splashDamage(w: WeaponDef, distance: number): number {
  if (!w.aoe || distance > w.aoe) return 0;
  return Math.round(w.damage * (1 - 0.6 * (distance / w.aoe)));
}
