// Player progress: credits, experience, cosmetics and the equipped loadout.
// Guests keep everything in this browser; accounts keep it in Lovable Cloud.

import { supabase } from "@/integrations/supabase/client";
import { isWeaponId, STARTER_WEAPON, WEAPONS, WEAPON_IDS, type WeaponId } from "./sim/weapons";
import { waveCredits, type Difficulty } from "./sim/waves";
import type { MapId } from "./sim/maps";
import { COSMETICS, isCosmeticId, type CosmeticId, type CosmeticSlot } from "./sim/cosmetics";
import {
  isWeaponSkinId,
  rollLottery,
  rollWeaponSkin,
  type WeaponSkinId,
  type WeaponSkinRarity,
  LOTTERY_PRICE,
  WEAPON_CRATES,
  WEAPON_SKINS,
} from "./sim/gacha";
import {
  DEFAULT_AVATAR_COLORS,
  isAvatarColors,
  type AvatarColors,
} from "./sim/avatar";
import { addExperience, DUNGEON_CLEAR_CREDITS, DUNGEON_CLEAR_EXPERIENCE, DUNGEON_WAVES, waveExperience } from "./sim/progression";
import {
  canCraft,
  canEnchant,
  CRAFTING_RECIPES,
  EMPTY_LOOT_INVENTORY,
  rollDungeonDrop,
  type LootInventory,
} from "./sim/dungeonLoot";
import {
  addHotbarItem,
  HOTBAR_BUNDLE_LIMIT,
  HOTBAR_SLOT_COUNT,
  HOTBAR_STACK_LIMIT,
  parseHotbar,
  removeHotbarItem,
  type HotbarItemId,
} from "./sim/hotbar";
import {
  awardWaveCredits,
  collectExperience as collectExperienceForAccount,
  equipCosmeticItem,
  equipWeapon,
  getProfile,
  importGuestProgress,
  purchaseCosmetic,
  purchaseWeapon,
  openWeaponCrate as openWeaponCrateForAccount,
  spinCreditLottery,
  unlockAvatarCustomization as unlockAvatarCustomizationForAccount,
  equipWeaponSkin as equipWeaponSkinForAccount,
  saveAvatarColors,
  recordPlayerSession,
  renamePlayer,
  spendCreditsForCraft,
} from "./profile.functions";

const STORE_KEY = "mso-progress-v1";
const IMPORT_KEY = "mso-imported-v1";
const LOOT_KEY_PREFIX = "mso-dungeon-loot-v1:";
const CODES_KEY = "mso-redeemed-codes-v1";
let lootStorageKey = `${LOOT_KEY_PREFIX}guest`;

function loadRedeemedCodes(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(CODES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((code): code is string => typeof code === "string") : [];
  } catch {
    return [];
  }
}

function saveRedeemedCodes(codes: string[]) {
  localStorage.setItem(CODES_KEY, JSON.stringify(codes));
}

function loadLoot(key: string): LootInventory {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(EMPTY_LOOT_INVENTORY);
    const parsed = JSON.parse(raw) as Partial<LootInventory>;
    const loot: LootInventory = {
      materials: {
        scrap: Math.max(0, Math.floor(parsed.materials?.scrap ?? 0)),
        bone: Math.max(0, Math.floor(parsed.materials?.bone ?? 0)),
        essence: Math.max(0, Math.floor(parsed.materials?.essence ?? 0)),
      },
      books: Math.max(0, Math.floor(parsed.books ?? 0)),
      shards: Math.max(0, Math.floor(parsed.shards ?? 0)),
      crafted: Array.isArray(parsed.crafted)
        ? parsed.crafted.filter((id) => typeof id === "string")
        : [],
      enchanted: Array.isArray(parsed.enchanted)
        ? parsed.enchanted.filter((id) => typeof id === "string")
        : [],
      hotbar: parseHotbar(parsed.hotbar),
    };
    if (!parsed.hotbar) {
      const oldItems: [HotbarItemId, number][] = [
        ["scrap", loot.materials.scrap],
        ["bone", loot.materials.bone],
        ["essence", loot.materials.essence],
        ["book", loot.books],
        ["shard", loot.shards],
        ...loot.crafted
          .filter(
            (id): id is "scrap-sword" | "ember-sword" | "bone-armor" =>
              id === "scrap-sword" || id === "ember-sword" || id === "bone-armor",
          )
          .map((id): [HotbarItemId, number] => [id, 1]),
      ];
      let hotbar = loot.hotbar;
      const migrationLimit = HOTBAR_SLOT_COUNT * HOTBAR_STACK_LIMIT + HOTBAR_BUNDLE_LIMIT;
      for (const [item, count] of oldItems) {
        for (let i = 0; i < Math.min(count, migrationLimit); i++) {
          const added = addHotbarItem(hotbar, item);
          if (added.accepted) hotbar = added.inventory;
        }
      }
      loot.hotbar = hotbar;
    }
    return loot;
  } catch {
    return structuredClone(EMPTY_LOOT_INVENTORY);
  }
}

function saveLoot(loot: LootInventory) {
  localStorage.setItem(lootStorageKey, JSON.stringify(loot));
}

function removeLootItem(loot: LootInventory, item: HotbarItemId): void {
  if (item === "book") loot.books = Math.max(0, loot.books - 1);
  else if (item === "shard") loot.shards = Math.max(0, loot.shards - 1);
  else if (item === "scrap-sword" || item === "ember-sword" || item === "bone-armor") {
    loot.crafted = loot.crafted.filter((crafted) => crafted !== item);
    loot.enchanted = loot.enchanted.filter((enchanted) => !enchanted.startsWith(`${item}:`));
  } else {
    loot.materials[item] = Math.max(0, loot.materials[item] - 1);
  }
}

export interface Progress {
  kind: "loading" | "guest" | "account";
  name: string;
  credits: number;
  level: number;
  experience: number;
  dungeonsCompleted: number;
  playSeconds: number;
  enemiesKilled: number;
  deaths: number;
  weapons: WeaponId[];
  equipped: WeaponId;
  cosmetics: CosmeticId[];
  equippedShirt: CosmeticId | null;
  equippedHat: CosmeticId | null;
  equippedPants: CosmeticId | null;
  equippedBoots: CosmeticId | null;
  weaponSkins: WeaponSkinId[];
  equippedWeaponSkin: WeaponSkinId | null;
  avatarCustomizationUnlocked: boolean;
  avatarColors: AvatarColors;
  loot: LootInventory;
  redeemedCodes: string[];
  racingUnlocked: boolean;
  email?: string | undefined;
}

type Listener = (p: Progress) => void;

let state: Progress = {
  kind: "loading",
  name: "Player",
  credits: 0,
  level: 1,
  experience: 0,
  dungeonsCompleted: 0,
  playSeconds: 0,
  enemiesKilled: 0,
  deaths: 0,
  weapons: [STARTER_WEAPON],
  equipped: STARTER_WEAPON,
  cosmetics: [],
  equippedShirt: null,
  equippedHat: null,
  equippedPants: null,
  equippedBoots: null,
  weaponSkins: [],
  equippedWeaponSkin: null,
  avatarCustomizationUnlocked: false,
  avatarColors: DEFAULT_AVATAR_COLORS,
  loot: structuredClone(EMPTY_LOOT_INVENTORY),
  redeemedCodes: [],
  racingUnlocked: false,
};
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(state);
}

export function getProgress(): Progress {
  return state;
}

export function subscribeProgress(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function loadGuest(): Progress {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress> & {
        avatarSkinTone?: unknown;
        avatarHairColor?: unknown;
      };
      const weapons = (p.weapons ?? []).filter(isWeaponId);
      if (!weapons.includes(STARTER_WEAPON)) weapons.unshift(STARTER_WEAPON);
      const level = Math.max(1, Math.floor(Number(p.level) || 1));
      const xp = addExperience({ level, experience: 0 }, Math.max(0, Math.floor(Number(p.experience) || 0)));
      const legacyAvatarColors = {
        ...DEFAULT_AVATAR_COLORS,
        ...(typeof p.avatarSkinTone === "string" ? { headColor: p.avatarSkinTone } : {}),
        ...(typeof p.avatarHairColor === "string" ? { hairColor: p.avatarHairColor } : {}),
      };
      return {
        kind: "guest",
        name: p.name ?? guestName(),
        credits: Math.max(0, Number(p.credits) || 0),
        ...xp,
        dungeonsCompleted: Math.max(0, Math.floor(Number(p.dungeonsCompleted) || 0)),
        playSeconds: Math.max(0, Math.floor(Number(p.playSeconds) || 0)),
        enemiesKilled: Math.max(0, Math.floor(Number(p.enemiesKilled) || 0)),
        deaths: Math.max(0, Math.floor(Number(p.deaths) || 0)),
        weapons: [...new Set(weapons)],
        equipped: isWeaponId(String(p.equipped)) ? (p.equipped as WeaponId) : STARTER_WEAPON,
        cosmetics: [...new Set((p.cosmetics ?? []).filter(isCosmeticId))],
        equippedShirt: isCosmeticId(String(p.equippedShirt)) ? (p.equippedShirt as CosmeticId) : null,
        equippedHat: isCosmeticId(String(p.equippedHat)) ? (p.equippedHat as CosmeticId) : null,
        equippedPants: isCosmeticId(String(p.equippedPants))
          ? (p.equippedPants as CosmeticId)
          : null,
        equippedBoots: isCosmeticId(String(p.equippedBoots))
          ? (p.equippedBoots as CosmeticId)
          : null,
        weaponSkins: [...new Set((p.weaponSkins ?? []).filter(isWeaponSkinId))],
        equippedWeaponSkin: isWeaponSkinId(String(p.equippedWeaponSkin))
          ? (p.equippedWeaponSkin as WeaponSkinId)
          : null,
        avatarCustomizationUnlocked: p.avatarCustomizationUnlocked === true,
        avatarColors: isAvatarColors(p.avatarColors)
          ? p.avatarColors
          : isAvatarColors(legacyAvatarColors)
            ? legacyAvatarColors
            : DEFAULT_AVATAR_COLORS,
        loot: loadLoot(lootStorageKey),
        redeemedCodes: loadRedeemedCodes(),
        racingUnlocked: loadRedeemedCodes().includes("GUNRACE"),
      };
    }
  } catch {
    /* corrupted store — fall through to a fresh guest */
  }
  const fresh: Progress = {
    kind: "guest",
    name: guestName(),
    credits: 0,
    level: 1,
    experience: 0,
    dungeonsCompleted: 0,
    playSeconds: 0,
    enemiesKilled: 0,
    deaths: 0,
    weapons: [STARTER_WEAPON],
    equipped: STARTER_WEAPON,
    cosmetics: [],
    equippedShirt: null,
    equippedHat: null,
    equippedPants: null,
    equippedBoots: null,
    weaponSkins: [],
    equippedWeaponSkin: null,
    avatarCustomizationUnlocked: false,
    avatarColors: DEFAULT_AVATAR_COLORS,
    loot: loadLoot(lootStorageKey),
    redeemedCodes: loadRedeemedCodes(),
    racingUnlocked: loadRedeemedCodes().includes("GUNRACE"),
  };
  saveGuest(fresh);
  return fresh;
}

function saveGuest(p: Progress) {
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      name: p.name,
      credits: p.credits,
      level: p.level,
      experience: p.experience,
      dungeonsCompleted: p.dungeonsCompleted,
      playSeconds: p.playSeconds,
      enemiesKilled: p.enemiesKilled,
      deaths: p.deaths,
      weapons: p.weapons,
      equipped: p.equipped,
      cosmetics: p.cosmetics,
      equippedShirt: p.equippedShirt,
      equippedHat: p.equippedHat,
      equippedPants: p.equippedPants,
      equippedBoots: p.equippedBoots,
      weaponSkins: p.weaponSkins,
      equippedWeaponSkin: p.equippedWeaponSkin,
      avatarCustomizationUnlocked: p.avatarCustomizationUnlocked,
      avatarColors: p.avatarColors,
    }),
  );
}

function guestName(): string {
  return `Guest ${Math.floor(100 + Math.random() * 900)}`;
}

/** Call once on app start (and again after sign-in/sign-out). */
export async function initProgress(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    lootStorageKey = `${LOOT_KEY_PREFIX}${data.session.user.id}`;
    try {
      const profile = await getProfile();
      state = {
        kind: "account",
        name: profile.name,
        credits: profile.credits,
        level: profile.level,
        experience: profile.experience,
        dungeonsCompleted: profile.dungeonsCompleted,
        playSeconds: profile.playSeconds,
        enemiesKilled: profile.enemiesKilled,
        deaths: profile.deaths,
        weapons: [...new Set([...profile.weapons.filter(isWeaponId), STARTER_WEAPON])],
        equipped: isWeaponId(profile.equipped) ? (profile.equipped as WeaponId) : STARTER_WEAPON,
        cosmetics: profile.cosmetics.filter(isCosmeticId),
        equippedShirt:
          typeof profile.equippedShirt === "string" && isCosmeticId(profile.equippedShirt)
            ? profile.equippedShirt
            : null,
        equippedHat:
          typeof profile.equippedHat === "string" && isCosmeticId(profile.equippedHat)
            ? profile.equippedHat
            : null,
        equippedPants:
          typeof profile.equippedPants === "string" && isCosmeticId(profile.equippedPants)
            ? profile.equippedPants
            : null,
        equippedBoots:
          typeof profile.equippedBoots === "string" && isCosmeticId(profile.equippedBoots)
            ? profile.equippedBoots
            : null,
        weaponSkins: profile.weaponSkins.filter(isWeaponSkinId),
        equippedWeaponSkin:
          typeof profile.equippedWeaponSkin === "string" &&
          isWeaponSkinId(profile.equippedWeaponSkin)
            ? profile.equippedWeaponSkin
            : null,
        avatarCustomizationUnlocked: profile.avatarCustomizationUnlocked,
        avatarColors: isAvatarColors(profile.avatarColors)
          ? profile.avatarColors
          : DEFAULT_AVATAR_COLORS,
        loot: loadLoot(lootStorageKey),
        redeemedCodes: loadRedeemedCodes(),
        racingUnlocked: loadRedeemedCodes().includes("GUNRACE"),
        email: data.session.user.email ?? undefined,
      };
      notify();
      await maybeImportGuest();
      return;
    } catch {
      // signed in but no profile row yet (e.g. email not confirmed flow) — fall back to guest view
    }
  }
  lootStorageKey = `${LOOT_KEY_PREFIX}guest`;
  state = loadGuest();
  notify();
}

async function maybeImportGuest() {
  if (localStorage.getItem(IMPORT_KEY)) return;
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    localStorage.setItem(IMPORT_KEY, "1");
    return;
  }
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    const hasStuff =
      (Number(p.credits) || 0) > 0 ||
      (Number(p.level) || 1) > 1 ||
      (Number(p.experience) || 0) > 0 ||
      (Number(p.dungeonsCompleted) || 0) > 0 ||
      (Number(p.playSeconds) || 0) > 0 ||
      (Number(p.enemiesKilled) || 0) > 0 ||
      (Number(p.deaths) || 0) > 0 ||
      (p.weapons?.length ?? 0) > 1 ||
      (p.cosmetics?.length ?? 0) > 0 ||
      (p.weaponSkins?.length ?? 0) > 0;
    if (!hasStuff) {
      localStorage.setItem(IMPORT_KEY, "1");
      return;
    }
    const level = Math.max(1, Math.floor(Number(p.level) || 1));
    const xp = addExperience({ level, experience: 0 }, Math.max(0, Math.floor(Number(p.experience) || 0)));
    const res = await importGuestProgress({
      data: {
        credits: Math.max(0, Number(p.credits) || 0),
        ...xp,
        dungeonsCompleted: Math.max(0, Math.floor(Number(p.dungeonsCompleted) || 0)),
        playSeconds: Math.max(0, Math.floor(Number(p.playSeconds) || 0)),
        enemiesKilled: Math.max(0, Math.floor(Number(p.enemiesKilled) || 0)),
        deaths: Math.max(0, Math.floor(Number(p.deaths) || 0)),
        weapons: (p.weapons ?? []).filter(isWeaponId),
        cosmetics: (p.cosmetics ?? []).filter(isCosmeticId),
        weaponSkins: (p.weaponSkins ?? []).filter(isWeaponSkinId),
        equippedWeaponSkin:
          typeof p.equippedWeaponSkin === "string" && isWeaponSkinId(p.equippedWeaponSkin)
            ? p.equippedWeaponSkin
            : null,
      },
    });
    state = {
      ...state,
      credits: res.credits,
      level: res.level,
      experience: res.experience,
      dungeonsCompleted: res.dungeonsCompleted,
      playSeconds: res.playSeconds,
      enemiesKilled: res.enemiesKilled,
      deaths: res.deaths,
      weapons: [...new Set([...state.weapons, ...res.weapons])],
      cosmetics: [...new Set([...state.cosmetics, ...res.cosmetics])],
      weaponSkins: res.weaponSkins.filter(isWeaponSkinId),
      equippedWeaponSkin:
        res.equippedWeaponSkin && isWeaponSkinId(res.equippedWeaponSkin)
          ? res.equippedWeaponSkin
          : state.equippedWeaponSkin,
    };
    notify();
  } finally {
    localStorage.setItem(IMPORT_KEY, "1");
  }
}

/** Credits earned for clearing one dungeon wave. Returns the amount paid and the run id. */
export async function awardWave(
  map: MapId,
  difficulty: Difficulty,
  wave: number,
  runId: string | null,
  mode: "dungeon" | "coop" = "dungeon",
): Promise<{
  awarded: number;
  experience: number;
  levelsGained: number;
  level: number;
  runId: string | null;
}> {
  const payout = waveCredits(difficulty);
  const completed = mode === "dungeon" && wave === DUNGEON_WAVES;
  const awarded = payout + (completed ? DUNGEON_CLEAR_CREDITS : 0);
  const gainedExperience = waveExperience(difficulty) + (completed ? DUNGEON_CLEAR_EXPERIENCE : 0);
  if (state.kind === "account") {
    const res = await awardWaveCredits({ data: { map, difficulty, wave, runId, mode } });
    const levelsGained = Math.max(0, res.level - state.level);
    state = {
      ...state,
      credits: res.credits,
      level: res.level,
      experience: res.experience,
      dungeonsCompleted: res.dungeonsCompleted,
    };
    notify();
    return {
      awarded: res.awarded,
      experience: res.awardedExperience,
      levelsGained,
      level: res.level,
      runId: res.runId,
    };
  }
  const previousLevel = state.level;
  const xp = addExperience(state, gainedExperience);
  state = {
    ...state,
    credits: state.credits + awarded,
    dungeonsCompleted: state.dungeonsCompleted + (completed ? 1 : 0),
    ...xp,
  };
  saveGuest(state);
  notify();
  return {
    awarded,
    experience: gainedExperience,
    levelsGained: xp.level - previousLevel,
    level: xp.level,
    runId: null,
  };
}

export async function collectExperience(amount: number): Promise<{ levelsGained: number; level: number }> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100) {
    throw new Error("Invalid experience orb value");
  }
  if (state.kind === "account") {
    const result = await collectExperienceForAccount({ data: { amount } });
    const levelsGained = result.level - state.level;
    state = { ...state, level: result.level, experience: result.experience };
    notify();
    return { levelsGained, level: result.level };
  }
  const previousLevel = state.level;
  const updated = addExperience(state, amount);
  state = { ...state, ...updated };
  saveGuest(state);
  notify();
  return { levelsGained: updated.level - previousLevel, level: updated.level };
}

export interface SessionStats {
  seconds: number;
  kills: number;
  deaths: number;
}

export async function recordSessionStats(stats: SessionStats): Promise<void> {
  const clean = {
    seconds: Math.max(0, Math.min(86_400, Math.floor(stats.seconds))),
    kills: Math.max(0, Math.min(10_000, Math.floor(stats.kills))),
    deaths: Math.max(0, Math.min(10_000, Math.floor(stats.deaths))),
  };
  if (state.kind === "account") {
    const updated = await recordPlayerSession({ data: clean });
    state = {
      ...state,
      playSeconds: updated.playSeconds,
      enemiesKilled: updated.enemiesKilled,
      deaths: updated.deaths,
    };
  } else {
    state = {
      ...state,
      playSeconds: state.playSeconds + clean.seconds,
      enemiesKilled: state.enemiesKilled + clean.kills,
      deaths: state.deaths + clean.deaths,
    };
    saveGuest(state);
  }
  notify();
}

export async function buyWeapon(id: WeaponId): Promise<void> {
  const weapon = WEAPONS[id];
  if (state.kind === "account") {
    const res = await purchaseWeapon({ data: { weaponId: id } });
    state = { ...state, credits: res.credits, weapons: [...new Set([...state.weapons, id])] };
  } else {
    if (state.weapons.includes(id)) return;
    if (state.credits < weapon.price) throw new Error(`Need ${weapon.price - state.credits} more credits`);
    state = { ...state, credits: state.credits - weapon.price, weapons: [...state.weapons, id] };
    saveGuest(state);
  }
  notify();
}

export async function setEquipped(id: WeaponId): Promise<void> {
  if (!state.weapons.includes(id)) return;
  if (state.kind === "account") {
    await equipWeapon({ data: { weaponId: id } });
  } else {
    saveGuest({ ...state, equipped: id });
  }
  state = { ...state, equipped: id };
  notify();
}

export async function buyCosmetic(id: CosmeticId): Promise<void> {
  const item = COSMETICS.find((cosmetic) => cosmetic.id === id);
  if (!item) throw new Error("Unknown cosmetic");
  if (state.cosmetics.includes(id)) return;
  if (state.kind === "account") {
    const res = await purchaseCosmetic({ data: { cosmeticId: id } });
    state = { ...state, credits: res.credits, cosmetics: [...state.cosmetics, id] };
  } else {
    if (state.credits < item.price) throw new Error(`Need ${item.price - state.credits} more credits`);
    state = { ...state, credits: state.credits - item.price, cosmetics: [...state.cosmetics, id] };
    saveGuest(state);
  }
  notify();
}

export async function setEquippedCosmetic(slot: CosmeticSlot, id: CosmeticId | null): Promise<void> {
  if (id && (!state.cosmetics.includes(id) || !COSMETICS.some((item) => item.id === id && item.slot === slot))) {
    throw new Error("You don't own that cosmetic");
  }
  if (state.kind === "account") {
    await equipCosmeticItem({ data: { slot, cosmeticId: id } });
  }
  state = {
    ...state,
    ...(slot === "shirt"
      ? { equippedShirt: id }
      : slot === "hat"
        ? { equippedHat: id }
        : slot === "pants"
          ? { equippedPants: id }
          : { equippedBoots: id }),
  };
  if (state.kind === "guest") saveGuest(state);
  notify();
}

export async function openWeaponCrate(rarity: WeaponSkinRarity): Promise<{
  skinId: WeaponSkinId | null;
  refunded: boolean;
}> {
  const crate = WEAPON_CRATES.find((item) => item.rarity === rarity);
  if (!crate) throw new Error("Unknown crate rarity");
  if (state.credits < crate.price) {
    throw new Error(`Need ${crate.price - state.credits} more credits`);
  }

  if (state.kind === "account") {
    const result = await openWeaponCrateForAccount({ data: { rarity } });
    const skinId =
      typeof result.skinId === "string" && isWeaponSkinId(result.skinId)
        ? result.skinId
        : null;
    state = {
      ...state,
      credits: result.credits,
      weaponSkins: skinId
        ? [...new Set([...state.weaponSkins, skinId])]
        : state.weaponSkins,
    };
    notify();
    return { skinId, refunded: result.refunded };
  }

  const availableSkins = WEAPON_SKINS.filter(
    (skin) => skin.rarity === rarity && !state.weaponSkins.includes(skin.id),
  );
  if (availableSkins.length === 0) return { skinId: null, refunded: true };

  const skinId = rollWeaponSkin(rarity, Math.random, state.weaponSkins);
  state = {
    ...state,
    credits: state.credits - crate.price,
    weaponSkins: [...state.weaponSkins, skinId],
  };
  saveGuest(state);
  notify();
  return { skinId, refunded: false };
}

export async function spinLottery(): Promise<number> {
  if (state.credits < LOTTERY_PRICE) {
    throw new Error(`Need ${LOTTERY_PRICE - state.credits} more credits`);
  }
  if (state.kind === "account") {
    const result = await spinCreditLottery();
    state = { ...state, credits: result.credits };
    notify();
    return result.prize;
  }

  const prize = rollLottery();
  state = { ...state, credits: state.credits - LOTTERY_PRICE + prize };
  saveGuest(state);
  notify();
  return prize;
}

export async function equipWeaponSkin(skinId: WeaponSkinId | null): Promise<void> {
  if (skinId && !state.weaponSkins.includes(skinId)) {
    throw new Error("You don't own that weapon skin");
  }
  if (state.kind === "account") {
    await equipWeaponSkinForAccount({ data: { skinId } });
  }
  state = { ...state, equippedWeaponSkin: skinId };
  if (state.kind === "guest") saveGuest(state);
  notify();
}

export async function unlockAvatarCustomization(): Promise<void> {
  if (state.avatarCustomizationUnlocked) return;
  if (state.credits < 1000) {
    throw new Error(`Need ${1000 - state.credits} more credits`);
  }
  if (state.kind === "account") {
    const result = await unlockAvatarCustomizationForAccount();
    state = {
      ...state,
      credits: result.credits,
      avatarCustomizationUnlocked: result.unlocked,
    };
  } else {
    state = {
      ...state,
      credits: state.credits - 1000,
      avatarCustomizationUnlocked: true,
    };
    saveGuest(state);
  }
  notify();
}

export async function customizeAvatar(
  colors: AvatarColors,
): Promise<void> {
  if (!state.avatarCustomizationUnlocked) {
    throw new Error("Unlock avatar customization before changing your colors");
  }
  if (!isAvatarColors(colors)) {
    throw new Error("Choose colors from the available palettes");
  }
  if (state.kind === "account") await saveAvatarColors({ data: colors });
  state = { ...state, avatarColors: colors };
  if (state.kind === "guest") saveGuest(state);
  notify();
}

export async function setName(name: string): Promise<void> {
  const clean = name.trim().slice(0, 24) || state.name;
  if (state.kind === "account") {
    await renamePlayer({ data: { name: clean } });
  } else {
    saveGuest({ ...state, name: clean });
  }
  state = { ...state, name: clean };
  notify();
}

export function awardDungeonLoot(tier: "grunt" | "runner" | "brute" | "enchanter") {
  const rolledDrop = rollDungeonDrop(tier);
  const loot: LootInventory = {
    ...state.loot,
    materials: { ...state.loot.materials },
    hotbar: structuredClone(state.loot.hotbar),
  };
  const drop: ReturnType<typeof rollDungeonDrop> = {
    materials: {},
    book: false,
    shard: false,
    inventoryFull: false,
  };
  for (const [material, amount] of Object.entries(rolledDrop.materials)) {
    if (!amount) continue;
    for (let i = 0; i < amount; i++) {
      const added = addHotbarItem(loot.hotbar, material as HotbarItemId);
      if (!added.accepted) {
        drop.inventoryFull = true;
        continue;
      }
      loot.hotbar = added.inventory;
      if (added.replaced) removeLootItem(loot, added.replaced);
      loot.materials[material as keyof LootInventory["materials"]]++;
      drop.materials[material as keyof LootInventory["materials"]] =
        (drop.materials[material as keyof LootInventory["materials"]] ?? 0) + 1;
    }
  }
  if (rolledDrop.book) {
    const added = addHotbarItem(loot.hotbar, "book");
    if (added.accepted) {
      loot.hotbar = added.inventory;
      if (added.replaced) removeLootItem(loot, added.replaced);
      loot.books++;
      drop.book = true;
    } else drop.inventoryFull = true;
  }
  if (rolledDrop.shard) {
    const added = addHotbarItem(loot.hotbar, "shard");
    if (added.accepted) {
      loot.hotbar = added.inventory;
      if (added.replaced) removeLootItem(loot, added.replaced);
      loot.shards++;
      drop.shard = true;
    } else drop.inventoryFull = true;
  }
  state = { ...state, loot };
  saveLoot(loot);
  notify();
  return drop;
}

export function findEnchantingBook(): boolean {
  const added = addHotbarItem(state.loot.hotbar, "book");
  if (!added.accepted) return false;
  const loot = { ...state.loot, hotbar: added.inventory };
  if (added.replaced) removeLootItem(loot, added.replaced);
  state = {
    ...state,
    loot: { ...loot, books: loot.books + 1 },
  };
  saveLoot(state.loot);
  notify();
  return true;
}

export async function craftDungeonItem(recipeId: string): Promise<void> {
  const recipe = CRAFTING_RECIPES.find((item) => item.id === recipeId);
  if (!recipe || !canCraft(state.loot, recipeId, state.credits)) {
    throw new Error("You need more materials or credits to craft this item");
  }
  const hotbar = addHotbarItem(state.loot.hotbar, recipe.id);
  if (!hotbar.accepted) {
    throw new Error("Your hotbar and bundle are full; make room before crafting");
  }
  const materials = { ...state.loot.materials };
  for (const [material, amount] of Object.entries(recipe.materials)) {
    materials[material as keyof typeof materials] -= amount;
  }
  const loot = {
    ...state.loot,
    materials,
    crafted: [...state.loot.crafted, recipeId],
    hotbar: hotbar.inventory,
  };
  if (hotbar.replaced && !(hotbar.replaced in recipe.materials)) {
    removeLootItem(loot, hotbar.replaced);
  }
  const credits =
    state.kind === "account"
      ? (await spendCreditsForCraft({ data: { recipeId } })).credits
      : state.credits - recipe.fee;
  state = { ...state, credits, loot };
  if (state.kind === "guest") saveGuest(state);
  saveLoot(loot);
  notify();
}

export function selectHotbarSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 9) return;
  state = {
    ...state,
    loot: { ...state.loot, hotbar: { ...state.loot.hotbar, selected: slot } },
  };
  saveLoot(state.loot);
  notify();
}

export function dropHotbarItem(): boolean {
  const { inventory: hotbar, item } = removeHotbarItem(
    state.loot.hotbar,
    state.loot.hotbar.selected,
  );
  if (!item) return false;
  const loot: LootInventory = { ...state.loot, hotbar };
  removeLootItem(loot, item);
  state = { ...state, loot };
  saveLoot(loot);
  notify();
  return true;
}

export function enchantDungeonItem(itemId: string, enchantmentId: string): void {
  if (!canEnchant(state.loot, itemId, enchantmentId)) {
    throw new Error("You need a crafted item, an enchanting book, and an enchanting shard");
  }
  const loot = {
    ...state.loot,
    books: state.loot.books - 1,
    shards: state.loot.shards - 1,
    enchanted: [...state.loot.enchanted, `${itemId}:${enchantmentId}`],
  };
  state = { ...state, loot };
  saveLoot(loot);
  notify();
}

export function redeemCode(input: string): { code: string; reward: string } {
  const code = input.trim().toUpperCase();
  if (state.redeemedCodes.includes(code)) throw new Error("That code has already been redeemed");
  if (code === "FREEMONEY") {
    state = { ...state, credits: state.credits + 500, redeemedCodes: [...state.redeemedCodes, code] };
    saveRedeemedCodes(state.redeemedCodes);
    if (state.kind === "guest") saveGuest(state);
    notify();
    return { code, reward: "+500 credits" };
  }
  if (code === "GUNRACE") {
    state = {
      ...state,
      racingUnlocked: true,
      redeemedCodes: [...state.redeemedCodes, code],
    };
    saveRedeemedCodes(state.redeemedCodes);
    if (state.kind === "guest") saveGuest(state);
    notify();
    return { code, reward: "Car race code redeemed" };
  }
  throw new Error("Unknown code");
}

// ---- Auth ----

export async function createAccount(email: string, password: string, name: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
  });
  if (error) throw error;
  // With email confirmation on, the session arrives after the link is clicked.
  return "check-email" as const;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await initProgress();
}

export async function signOut() {
  await supabase.auth.signOut();
  localStorage.removeItem(IMPORT_KEY);
  await initProgress();
}

export const allWeaponIds = WEAPON_IDS;
