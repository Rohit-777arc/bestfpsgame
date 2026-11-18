// Player progress: credits, experience, cosmetics and the equipped loadout.
// Guests keep everything in this browser; accounts keep it in Lovable Cloud.

import { supabase } from "@/integrations/supabase/client";
import { isWeaponId, STARTER_WEAPON, WEAPONS, WEAPON_IDS, type WeaponId } from "./sim/weapons";
import { waveCredits, type Difficulty } from "./sim/waves";
import type { MapId } from "./sim/maps";
import { COSMETICS, isCosmeticId, type CosmeticId, type CosmeticSlot } from "./sim/cosmetics";
import { addExperience, DUNGEON_CLEAR_CREDITS, DUNGEON_CLEAR_EXPERIENCE, DUNGEON_WAVES, waveExperience } from "./sim/progression";
import { awardWaveCredits, collectExperience as collectExperienceForAccount, equipCosmeticItem, equipWeapon, getProfile, importGuestProgress, purchaseCosmetic, purchaseWeapon, recordPlayerSession, renamePlayer } from "./profile.functions";

const STORE_KEY = "mso-progress-v1";
const IMPORT_KEY = "mso-imported-v1";

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
      const p = JSON.parse(raw) as Partial<Progress>;
      const weapons = (p.weapons ?? []).filter(isWeaponId);
      if (!weapons.includes(STARTER_WEAPON)) weapons.unshift(STARTER_WEAPON);
      const level = Math.max(1, Math.floor(Number(p.level) || 1));
      const xp = addExperience({ level, experience: 0 }, Math.max(0, Math.floor(Number(p.experience) || 0)));
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
        email: data.session.user.email ?? undefined,
      };
      notify();
      await maybeImportGuest();
      return;
    } catch {
      // signed in but no profile row yet (e.g. email not confirmed flow) — fall back to guest view
    }
  }
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
      (p.cosmetics?.length ?? 0) > 0;
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
    ...(slot === "shirt" ? { equippedShirt: id } : { equippedHat: id }),
  };
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
