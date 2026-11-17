import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isWeaponId, STARTER_WEAPON, WEAPONS } from "./sim/weapons";
import { waveCredits } from "./sim/waves";
import { COSMETICS, isCosmeticId } from "./sim/cosmetics";
import { addExperience, DUNGEON_CLEAR_CREDITS, DUNGEON_CLEAR_EXPERIENCE, DUNGEON_WAVES, totalExperience, waveExperience } from "./sim/progression";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: weapons }, { data: cosmetics }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, credits, equipped_weapon, level, experience, dungeons_completed, equipped_shirt, equipped_hat").eq("id", userId).single(),
      supabase.from("profile_weapons").select("weapon_id").eq("user_id", userId),
      supabase.from("profile_cosmetics").select("cosmetic_id").eq("user_id", userId),
    ]);
    return {
      name: profile?.display_name ?? "Player",
      credits: profile?.credits ?? 0,
      level: profile?.level ?? 1,
      experience: profile?.experience ?? 0,
      dungeonsCompleted: profile?.dungeons_completed ?? 0,
      equipped: profile?.equipped_weapon ?? "scout-pistol",
      weapons: (weapons ?? []).map((w) => String(w.weapon_id)),
      cosmetics: (cosmetics ?? []).map((item) => String(item.cosmetic_id)),
      equippedShirt: profile?.equipped_shirt ?? null,
      equippedHat: profile?.equipped_hat ?? null,
    };
  });

const awardInput = z.object({
  map: z.string().min(1).max(40),
  difficulty: z.enum(["easy", "normal", "hard"]),
  wave: z.number().int().min(1).max(999),
  runId: z.string().uuid().nullable(),
  mode: z.enum(["dungeon", "coop"]),
});

/** Credits a signed-in player earns for clearing one dungeon wave. */
export const awardWaveCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => awardInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.mode === "dungeon" && data.wave > DUNGEON_WAVES) {
      throw new Error("Dungeon is already complete");
    }
    const completed = data.mode === "dungeon" && data.wave === DUNGEON_WAVES;
    const payout = waveCredits(data.difficulty) + (completed ? DUNGEON_CLEAR_CREDITS : 0);
    const gainedExperience = waveExperience(data.difficulty) + (completed ? DUNGEON_CLEAR_EXPERIENCE : 0);

    let runId = data.runId;
    if (!runId) {
      if (data.wave !== 1) throw new Error("A dungeon run must start at wave one");
      const { data: run, error } = await supabase
        .from("runs")
        .insert({
          user_id: userId,
          mode: data.mode,
          map: data.map,
          difficulty: data.difficulty,
          waves_cleared: 1,
          credits_earned: payout,
        })
        .select("id")
        .single();
      if (error) throw new Error("Could not start run");
      runId = run.id;
    } else {
      const { data: run, error: runErr } = await supabase.from("runs").select("waves_cleared, credits_earned, completed_at").eq("id", runId).eq("user_id", userId).single();
      if (runErr || !run) throw new Error("Run not found");
      if (run.completed_at) throw new Error("Dungeon run is already complete");
      if (data.wave !== run.waves_cleared + 1) throw new Error("Waves must be cleared in order");
      const { error } = await supabase
        .from("runs")
        .update({
          waves_cleared: Math.max(run.waves_cleared, data.wave),
          credits_earned: run.credits_earned + payout,
          ...(completed ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq("id", runId)
        .eq("user_id", userId);
      if (error) throw new Error("Could not update run");
    }

    const { data: prof, error: profErr } = await supabase.from("profiles").select("credits, level, experience, dungeons_completed").eq("id", userId).single();
    if (profErr || !prof) throw new Error("Profile not found");
    const xp = addExperience(prof, gainedExperience);
    const { data: updated, error: updErr } = await supabase
      .from("profiles")
      .update({
        credits: prof.credits + payout,
        ...xp,
        dungeons_completed: prof.dungeons_completed + (completed ? 1 : 0),
      })
      .eq("id", userId)
      .select("credits, level, experience")
      .single();
    if (updErr || !updated) throw new Error("Could not add credits");

    return {
      credits: updated.credits,
      level: updated.level,
      experience: updated.experience,
      dungeonsCompleted: prof.dungeons_completed + (completed ? 1 : 0),
      runId,
      awarded: payout,
      awardedExperience: gainedExperience,
    };
  });

const purchaseInput = z.object({ weaponId: z.string() });

/** Buys a weapon with credits for a signed-in player. */
export const purchaseWeapon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => purchaseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isWeaponId(data.weaponId)) throw new Error("Unknown weapon");
    const weapon = WEAPONS[data.weaponId];

    const { data: prof, error: profErr } = await supabase.from("profiles").select("credits").eq("id", userId).single();
    if (profErr || !prof) throw new Error("Profile not found");

    const { data: owned } = await supabase.from("profile_weapons").select("weapon_id").eq("user_id", userId).eq("weapon_id", weapon.id).maybeSingle();
    if (owned) {
      return { credits: prof.credits, owned: true };
    }
    if (prof.credits < weapon.price) throw new Error("Not enough credits");

    const { error: insErr } = await supabase.from("profile_weapons").insert({ user_id: userId, weapon_id: weapon.id });
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
    if (data.weaponId !== STARTER_WEAPON) {
      const { data: owned } = await supabase.from("profile_weapons").select("weapon_id").eq("user_id", userId).eq("weapon_id", data.weaponId).maybeSingle();
      if (!owned) throw new Error("You don't own that weapon");
    }
    const { error } = await supabase.from("profiles").update({ equipped_weapon: data.weaponId }).eq("id", userId);
    if (error) throw new Error("Could not equip");
    return { equipped: data.weaponId };
  });

const cosmeticInput = z.object({ cosmeticId: z.string() });

export const purchaseCosmetic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cosmeticInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isCosmeticId(data.cosmeticId)) throw new Error("Unknown cosmetic");
    const item = COSMETICS.find((cosmetic) => cosmetic.id === data.cosmeticId);
    if (!item) throw new Error("Unknown cosmetic");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("credits").eq("id", userId).single();
    if (profileError || !profile) throw new Error("Profile not found");
    const { data: owned } = await supabase.from("profile_cosmetics").select("cosmetic_id").eq("user_id", userId).eq("cosmetic_id", item.id).maybeSingle();
    if (owned) return { credits: profile.credits, owned: true };
    if (profile.credits < item.price) throw new Error("Not enough credits");

    const { error: insertError } = await supabase.from("profile_cosmetics").insert({ user_id: userId, cosmetic_id: item.id });
    if (insertError) throw new Error("Could not save cosmetic");
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ credits: profile.credits - item.price })
      .eq("id", userId)
      .select("credits")
      .single();
    if (updateError || !updated) throw new Error("Could not charge credits");
    return { credits: updated.credits, owned: true };
  });

const equipCosmeticInput = z.object({
  slot: z.enum(["shirt", "hat"]),
  cosmeticId: z.string().nullable(),
});

export const equipCosmeticItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => equipCosmeticInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.cosmeticId) {
      if (!isCosmeticId(data.cosmeticId)) throw new Error("Unknown cosmetic");
      const item = COSMETICS.find((cosmetic) => cosmetic.id === data.cosmeticId);
      if (!item || item.slot !== data.slot) throw new Error("Cosmetic does not fit that slot");
      const { data: owned } = await supabase.from("profile_cosmetics").select("cosmetic_id").eq("user_id", userId).eq("cosmetic_id", data.cosmeticId).maybeSingle();
      if (!owned) throw new Error("You don't own that cosmetic");
    }
    const { error } = await supabase
      .from("profiles")
      .update(
        data.slot === "shirt"
          ? { equipped_shirt: data.cosmeticId }
          : { equipped_hat: data.cosmeticId },
      )
      .eq("id", userId);
    if (error) throw new Error("Could not equip cosmetic");
    return { slot: data.slot, cosmeticId: data.cosmeticId };
  });

const renameInput = z.object({ name: z.string().min(1).max(24) });

/** Renames the player. */
export const renamePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => renameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ display_name: data.name }).eq("id", userId);
    if (error) throw new Error("Could not rename");
    return { name: data.name };
  });

const importInput = z.object({
  credits: z.number().int().min(0).max(1_000_000),
  level: z.number().int().min(1).max(1_000_000),
  experience: z.number().int().min(0).max(1_000_000_000),
  dungeonsCompleted: z.number().int().min(0).max(1_000_000),
  weapons: z.array(z.string()).max(10),
  cosmetics: z.array(z.string()).max(20),
});

/** Carries a guest's browser progress over to a new account, once. */
export const importGuestProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("credits, level, experience, dungeons_completed").eq("id", userId).single();
    const target = Math.max(prof?.credits ?? 0, data.credits);
    const valid = data.weapons.filter(isWeaponId);
    if (valid.length) {
      await supabase.from("profile_weapons").upsert(
        valid.map((weapon_id) => ({ user_id: userId, weapon_id })),
        { ignoreDuplicates: true },
      );
    }
    const currentTotal = totalExperience(prof ?? { level: 1, experience: 0 });
    const guestTotal = totalExperience(data);
    const xp = addExperience(prof ?? { level: 1, experience: 0 }, Math.max(0, guestTotal - currentTotal));
    const dungeonsCompleted = Math.max(prof?.dungeons_completed ?? 0, data.dungeonsCompleted);
    await supabase
      .from("profiles")
      .update({
        credits: target,
        ...(guestTotal > currentTotal ? xp : {}),
        dungeons_completed: dungeonsCompleted,
      })
      .eq("id", userId);
    const validCosmetics = data.cosmetics.filter(isCosmeticId);
    if (validCosmetics.length) {
      await supabase.from("profile_cosmetics").upsert(
        validCosmetics.map((cosmetic_id) => ({ user_id: userId, cosmetic_id })),
        { ignoreDuplicates: true },
      );
    }
    return {
      credits: target,
      level: Math.max(prof?.level ?? 1, xp.level),
      experience: xp.experience,
      dungeonsCompleted,
      weapons: valid,
      cosmetics: validCosmetics,
    };
  });
