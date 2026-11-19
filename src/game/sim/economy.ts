import { WEAPONS, isWeaponId, STARTER_WEAPON, type WeaponId } from "./weapons";
import { COSMETICS, isCosmeticId, type CosmeticId, type CosmeticSlot } from "./cosmetics";
import {
  WEAPON_CRATES,
  getWeaponSkin,
  isWeaponSkinId,
  rollWeaponSkin,
  rollLottery,
  LOTTERY_PRICE,
  WEAPON_SKINS,
  type WeaponSkinId,
} from "./gacha";
import { DEFAULT_AVATAR_COLORS, isAvatarColors, type AvatarColors } from "./avatar";
import { EMPTY_LOOT_INVENTORY, CRAFTING_RECIPES, type LootInventory } from "./dungeonLoot";
import { addHotbarItem } from "./hotbar";
import { waveCredits, type Difficulty } from "./waves";
import { isFinalDungeonWave, DUNGEON_WAVES, DUNGEON_CLEAR_CREDITS } from "./progression";

export const UNLIMITED_CREDITS = Number.MAX_SAFE_INTEGER;
export const AVATAR_PRICE = 1250;
export type EconomyState = {
  credits: number;
  unlimitedMoney: boolean;
  redeemedCodes: string[];
  weapons: WeaponId[];
  cosmetics: CosmeticId[];
  weaponSkins: WeaponSkinId[];
  equipped: WeaponId;
  equippedShirt: CosmeticId | null;
  equippedHat: CosmeticId | null;
  equippedPants: CosmeticId | null;
  equippedBoots: CosmeticId | null;
  equippedWeaponSkin: WeaponSkinId | null;
  avatarCustomizationUnlocked: boolean;
  avatarColors: AvatarColors;
  loot: LootInventory;
  racingUnlocked: boolean;
  runId: string | null;
  wave: number;
  lastWaveAt: number;
};
export type EconomyAction =
  | { kind: "load" }
  | { kind: "code"; code: string }
  | { kind: "weapon" | "cosmetic" | "crate" | "craft"; id: string }
  | { kind: "lottery" | "avatar" }
  | { kind: "equipWeapon"; id: string }
  | { kind: "equipSkin"; id: string | null }
  | { kind: "equipCosmetic"; slot: CosmeticSlot; id: string | null }
  | { kind: "colors"; colors: AvatarColors }
  | { kind: "loot"; loot: LootInventory }
  | {
      kind: "wave";
      difficulty: Difficulty;
      wave: number;
      runId: string | null;
      mode: "dungeon" | "coop";
      variant?: "gunfight" | "underground";
    };

export function freshEconomy(seed: Partial<EconomyState> = {}): EconomyState {
  return {
    credits: Math.min(1_000_000, Math.max(0, Math.floor(seed.credits ?? 0))),
    unlimitedMoney: false,
    redeemedCodes: (seed.redeemedCodes ?? []).filter(
      (code) => code === "FREEMONEY" || code === "GUNRACE",
    ),
    weapons: [...new Set([STARTER_WEAPON, ...(seed.weapons ?? []).filter(isWeaponId)])],
    cosmetics: (seed.cosmetics ?? []).filter(isCosmeticId),
    weaponSkins: (seed.weaponSkins ?? []).filter(isWeaponSkinId),
    equipped: seed.equipped ?? STARTER_WEAPON,
    equippedShirt: seed.equippedShirt ?? null,
    equippedHat: seed.equippedHat ?? null,
    equippedPants: seed.equippedPants ?? null,
    equippedBoots: seed.equippedBoots ?? null,
    equippedWeaponSkin: seed.equippedWeaponSkin ?? null,
    avatarCustomizationUnlocked: seed.avatarCustomizationUnlocked ?? false,
    avatarColors: seed.avatarColors ?? DEFAULT_AVATAR_COLORS,
    loot: seed.loot ?? structuredClone(EMPTY_LOOT_INVENTORY),
    racingUnlocked: seed.racingUnlocked ?? false,
    runId: null,
    wave: 0,
    lastWaveAt: 0,
  };
}

export function applyEconomyAction(
  current: EconomyState,
  action: EconomyAction,
  random = Math.random,
  now = Date.now(),
  newRunId = "",
) {
  const state = structuredClone(current);
  let reward = "";
  let skinId: WeaponSkinId | null = null;
  let refunded = false;
  let prize = 0;
  function spend(amount: number) {
    if (state.unlimitedMoney) return;
    if (state.credits < amount) throw new Error(`Need ${amount - state.credits} more credits`);
    state.credits -= amount;
  }
  switch (action.kind) {
    case "load":
      break;
    case "code": {
      const code = action.code.trim().toUpperCase();
      if (state.redeemedCodes.includes(code))
        throw new Error("That code has already been redeemed");
      if (code === "INFMONEOWNERONLY") {
        state.unlimitedMoney = true;
        reward = "Unlimited money unlocked";
      } else if (code === "FREEMONEYBOI" || code === "FREEMONEY") {
        state.credits += 500;
        reward = "+500 credits";
      } else if (code === "1PLSENCHANTSHRD") {
        const added = addHotbarItem(state.loot.hotbar, "shard");
        if (!added.accepted || added.replaced)
          throw new Error("Make room in your hotbar or bundle before redeeming");
        state.loot.hotbar = added.inventory;
        state.loot.shards++;
        reward = "+1 enchanting shard";
      } else if (code === "GUNRACE") {
        state.racingUnlocked = true;
        reward = "Car race code redeemed";
      } else throw new Error("Unknown code");
      state.redeemedCodes.push(code);
      break;
    }
    case "weapon":
      if (!isWeaponId(action.id)) throw new Error("Unknown weapon");
      if (!state.weapons.includes(action.id)) {
        spend(WEAPONS[action.id].price);
        state.weapons.push(action.id);
      }
      break;
    case "cosmetic": {
      const item = COSMETICS.find((i) => i.id === action.id);
      if (!item) throw new Error("Unknown cosmetic");
      if (!state.cosmetics.includes(item.id)) {
        spend(item.price);
        state.cosmetics.push(item.id);
      }
      break;
    }
    case "crate": {
      const crate = WEAPON_CRATES.find((i) => i.rarity === action.id);
      if (!crate) throw new Error("Unknown crate");
      if (
        state.weaponSkins.filter((id) => getWeaponSkin(id)?.rarity === crate.rarity).length >=
        WEAPON_SKINS.filter((skin) => skin.rarity === crate.rarity).length
      ) {
        refunded = true;
        break;
      }
      spend(crate.price);
      skinId = rollWeaponSkin(crate.rarity, random, state.weaponSkins);
      state.weaponSkins.push(skinId);
      break;
    }
    case "lottery":
      spend(LOTTERY_PRICE);
      prize = rollLottery(random);
      state.credits += prize;
      break;
    case "avatar":
      if (!state.avatarCustomizationUnlocked) {
        spend(AVATAR_PRICE);
        state.avatarCustomizationUnlocked = true;
      }
      break;
    case "equipWeapon":
      if (!isWeaponId(action.id) || !state.weapons.includes(action.id))
        throw new Error("You don't own that weapon");
      state.equipped = action.id;
      break;
    case "equipSkin":
      if (
        action.id !== null &&
        (!isWeaponSkinId(action.id) || !state.weaponSkins.includes(action.id))
      )
        throw new Error("You don't own that skin");
      state.equippedWeaponSkin = action.id as WeaponSkinId | null;
      break;
    case "equipCosmetic": {
      const item = COSMETICS.find((i) => i.id === action.id && i.slot === action.slot);
      if (action.id !== null && (!item || !state.cosmetics.includes(item.id)))
        throw new Error("You don't own that cosmetic");
      const key = {
        shirt: "equippedShirt",
        hat: "equippedHat",
        pants: "equippedPants",
        boots: "equippedBoots",
      } as const;
      state[key[action.slot]] = action.id as CosmeticId | null;
      break;
    }
    case "colors":
      if (!state.avatarCustomizationUnlocked || !isAvatarColors(action.colors))
        throw new Error("Unlock customization and choose palette colors");
      state.avatarColors = action.colors;
      break;
    case "loot":
      state.loot = action.loot;
      break;
    case "craft": {
      const recipe = CRAFTING_RECIPES.find((i) => i.id === action.id);
      if (!recipe) throw new Error("Unknown recipe");
      spend(recipe.fee);
      break;
    }
    case "wave": {
      if (now - state.lastWaveAt < 5000) throw new Error("Wave reward is not ready yet");
      if (action.wave !== 1 && (action.runId !== state.runId || action.wave !== state.wave + 1))
        throw new Error("Waves must be cleared in order");
      if (action.mode === "dungeon" && action.variant !== "underground" && action.wave > DUNGEON_WAVES)
        throw new Error("Dungeon is complete");
      state.runId = action.wave === 1 ? (action.runId ?? newRunId) : state.runId;
      state.wave = action.wave;
      state.lastWaveAt = now;
      state.credits +=
        waveCredits(action.difficulty) +
        (isFinalDungeonWave(action.mode, action.wave, action.variant) ? DUNGEON_CLEAR_CREDITS : 0);
      break;
    }
  }
  return { state, reward, skinId, refunded, prize };
}
