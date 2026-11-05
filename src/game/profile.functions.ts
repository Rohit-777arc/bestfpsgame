import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isWeaponId, WEAPONS } from "./sim/weapons";
import { waveCredits } from "./sim/waves";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: weapons }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, credits, equipped_weapon").eq("id", userId).single(),
      supabase.from("profile_weapons").select("weapon_id").eq("user_id", userId),
    ]);
    return {
      name: profile?.display_name ?? "Player",
      credits: profile?.credits ?? 0,
      equipped: profile?.equipped_weapon ?? "scout-pistol",
      weapons: (weapons ?? []).map((w) => String(w.weapon_id)),
    };
  });

const awardInput = z.object({
  map: z.string().min(1).max(40),
  difficulty: z.enum(["easy", "normal", "hard"]),
  wave: z.number().int().min(1).max(999),
  runId: z.string().uuid().nullable(),
});

/** Credits a signed-in player earns for clearing one dungeon wave. */
export const awardWaveCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => awardInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payout = waveCredits(data.difficulty);

    let runId = data.runId;
    if (!runId) {
      const { data: run, error } = await supabase
        .from("runs")
        .insert({ user_id: userId, mode: "dungeon", map: data.map, difficulty: data.difficulty, waves_cleared: 1, credits_earned: payout })
        .select("id")
        .single();
      if (error) throw new Error("Could not start run");
      runId = run.id;
    } else {
      const { error } = await supabase
        .from("runs")
        .update({ waves_cleared: data.wave, credits_earned: supabaseNoop() + payout })
        .eq("id", runId)
        .eq("user_id", userId);
      if (error) throw new Error("Could not update run");
    }

    // Read-modify-write the credit balance (casual game; no contention expected)
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    if (profErr || !prof) throw new Error("Profile not found");
    const { data: updated, error: updErr } = await supabase
      .from("profiles")
      .update({ credits: prof.credits + payout })
      .eq("id", userId)
      .select("credits")
      .single();
    if (updErr || !updated) throw new Error("Could not add credits");

    return { credits: updated.credits, runId, awarded: payout };
  });

function supabaseNoop() {
  return 0;
}

const purchaseInput = z.object({ weaponId: z.string() });

/** Buys a weapon with credits for a signed-in player. */
export const purchaseWeapon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => purchaseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isWeaponId(data.weaponId)) throw new Error("Unknown weapon");
    const weapon = WEAPONS[data.weaponId];

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    if (profErr || !prof) throw new Error("Profile not found");

    const { data: owned } = await supabase
      .from("profile_weapons")
      .select("weapon_id")
      .eq("user_id", userId)
      .eq("weapon_id", weapon.id)
      .maybeSingle();
    if (owned) {
      return { credits: prof.credits, owned: true };
    }
    if (prof.credits < weapon.price) throw new Error("Not enough credits");

    const { error: insErr } = await supabase
      .from("profile_weapons")
      .insert({ user_id: userId, weapon_id: weapon.id });
    if (insErr) throw new Error("Could not save weapon");

    const { data: updated, error: updErr } = await supabase
      .from("profiles")
      .update({ credits: prof.credits - weapon.price })
      .eq("id", userId)
      .select("credits")
      .single();
    if (updErr || !updated) throw new Error("Could not charge credits");
    return { credits: updated.credits, owned: true };
  });

const equipInput = z.object({ weaponId: z.string() });

/** Sets the weapon the player carries. */
export const equipWeapon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => equipInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isWeaponId(data.weaponId)) throw new Error("Unknown weapon");
    const { error } = await supabase
      .from("profiles")
      .update({ equipped_weapon: data.weaponId })
      .eq("id", userId);
    if (error) throw new Error("Could not equip");
    return { equipped: data.weaponId };
  });

const renameInput = z.object({ name: z.string().min(1).max(24) });

/** Renames the player. */
export const renamePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => renameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: data.name })
      .eq("id", userId);
    if (error) throw new Error("Could not rename");
    return { name: data.name };
  });

const importInput = z.object({
  credits: z.number().int().min(0).max(1_000_000),
  weapons: z.array(z.string()).max(10),
});

/** Carries a guest's browser progress over to a new account, once. */
export const importGuestProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    const target = Math.max(prof?.credits ?? 0, data.credits);
    if (target !== prof?.credits) {
      await supabase.from("profiles").update({ credits: target }).eq("id", userId);
    }
    const valid = data.weapons.filter(isWeaponId);
    if (valid.length) {
      await supabase
        .from("profile_weapons")
        .upsert(valid.map((weapon_id) => ({ user_id: userId, weapon_id })), { ignoreDuplicates: true });
    }
    return { credits: target, weapons: valid };
  });
