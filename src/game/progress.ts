// Player progress: credits, owned weapons and the equipped gun.
// Guests keep everything in this browser; accounts keep it in Lovable Cloud.

import { supabase } from "@/integrations/supabase/client";
import {
  isWeaponId,
  STARTER_WEAPON,
  WEAPONS,
  WEAPON_IDS,
  type WeaponId,
} from "./sim/weapons";
import { waveCredits, type Difficulty } from "./sim/waves";
import type { MapId } from "./sim/maps";
import {
  awardWaveCredits,
  equipWeapon,
  getProfile,
  importGuestProgress,
  purchaseWeapon,
  renamePlayer,
} from "./profile.functions";

const STORE_KEY = "mso-progress-v1";
const IMPORT_KEY = "mso-imported-v1";

export interface Progress {
  kind: "loading" | "guest" | "account";
  name: string;
  credits: number;
  weapons: WeaponId[];
  equipped: WeaponId;
  email?: string | undefined;
}

type Listener = (p: Progress) => void;

let state: Progress = { kind: "loading", name: "Player", credits: 0, weapons: [STARTER_WEAPON], equipped: STARTER_WEAPON };
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
      return {
        kind: "guest",
        name: p.name ?? guestName(),
        credits: Math.max(0, Number(p.credits) || 0),
        weapons: [...new Set(weapons)],
        equipped: isWeaponId(String(p.equipped)) ? (p.equipped as WeaponId) : STARTER_WEAPON,
      };
    }
  } catch {
    /* corrupted store — fall through to a fresh guest */
  }
  const fresh: Progress = { kind: "guest", name: guestName(), credits: 0, weapons: [STARTER_WEAPON], equipped: STARTER_WEAPON };
  saveGuest(fresh);
  return fresh;
}

function saveGuest(p: Progress) {
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({ name: p.name, credits: p.credits, weapons: p.weapons, equipped: p.equipped }),
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
        weapons: [...new Set([...profile.weapons.filter(isWeaponId), STARTER_WEAPON])],
        equipped: isWeaponId(profile.equipped) ? (profile.equipped as WeaponId) : STARTER_WEAPON,
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
    const hasStuff = (Number(p.credits) || 0) > 0 || (p.weapons?.length ?? 0) > 1;
    if (!hasStuff) {
      localStorage.setItem(IMPORT_KEY, "1");
      return;
    }
    const res = await importGuestProgress({
      data: { credits: Math.max(0, Number(p.credits) || 0), weapons: (p.weapons ?? []).filter(isWeaponId) },
    });
    state = { ...state, credits: res.credits, weapons: [...new Set([...state.weapons, ...res.weapons])] };
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
): Promise<{ awarded: number; runId: string | null }> {
  const payout = waveCredits(difficulty);
  if (state.kind === "account") {
    const res = await awardWaveCredits({ data: { map, difficulty, wave, runId } });
    state = { ...state, credits: res.credits };
    notify();
    return { awarded: payout, runId: res.runId };
  }
  state = { ...state, credits: state.credits + payout };
  saveGuest(state);
  notify();
  return { awarded: payout, runId: null };
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
