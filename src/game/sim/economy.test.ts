import { describe, expect, it } from "vitest";
import { applyEconomyAction, freshEconomy, AVATAR_PRICE } from "./economy";
import { EMPTY_LOOT_INVENTORY } from "./dungeonLoot";
import { WEAPONS } from "./weapons";
import { WEAPON_CRATES, LOTTERY_PRICE } from "./gacha";
import { waveCredits } from "./waves";
import { DUNGEON_CLEAR_CREDITS } from "./progression";

const redeem = (code: string) => applyEconomyAction(freshEconomy(), { kind: "code", code });

describe("reward codes", () => {
  it("awards exactly 500 coins, ignoring case and surrounding whitespace", () => {
    const result = redeem(" freemoneyboi ");
    expect(result.state.credits).toBe(500);
    expect(result.reward).toBe("+500 credits");
    expect(() => applyEconomyAction(result.state, { kind: "code", code: "FREEMONEYBOI" })).toThrow(
      "already been redeemed",
    );
  });
  it("adds exactly one usable enchanting shard", () => {
    const { state } = redeem("1plsenchantshrd");
    expect(state.loot.shards).toBe(1);
    expect(state.loot.hotbar.slots.some((slot) => slot?.item === "shard" && slot.count === 1)).toBe(
      true,
    );
    expect(() => applyEconomyAction(state, { kind: "code", code: "1PLSENCHANTSHRD" })).toThrow(
      "already been redeemed",
    );
  });
  it("leaves the code unclaimed if there is no inventory space", () => {
    const state = freshEconomy();
    state.loot.hotbar.slots = Array.from({ length: 8 }, () => ({ item: "shard", count: 8 }));
    state.loot.hotbar.bundle = Array.from({ length: 10 }, () => ({ item: "shard", count: 8 }));
    expect(() => applyEconomyAction(state, { kind: "code", code: "1PLSENCHANTSHRD" })).toThrow(
      "Make room",
    );
    expect(state.redeemedCodes).toEqual([]);
  });
  it("rejects unknown codes without mutating progress", () => {
    const state = freshEconomy();
    expect(() => applyEconomyAction(state, { kind: "code", code: "NOPE" })).toThrow("Unknown code");
    expect(state.credits).toBe(0);
    expect(state.loot).toEqual(EMPTY_LOOT_INVENTORY);
  });
  it("preserves the old money and race codes", () => {
    expect(redeem("freemoney").state.credits).toBe(500);
    expect(redeem("gunrace").state.racingUnlocked).toBe(true);
  });
});

describe("unlimited money", () => {
  it("survives JSON persistence and never deducts coins across all purchase types", () => {
    let state = JSON.parse(JSON.stringify(redeem("infmoneowneronly").state));
    for (const action of [
      { kind: "weapon", id: "longbow-sniper" },
      { kind: "cosmetic", id: "opgod-armour" },
      { kind: "crate", id: "secret" },
      { kind: "avatar" },
      { kind: "craft", id: "ember-sword" },
    ] as const) {
      state = applyEconomyAction(state, action, () => 0).state;
      expect(state.unlimitedMoney).toBe(true);
      expect(state.credits).toBe(0);
    }
    expect(state.weapons).toContain("longbow-sniper");
    expect(state.cosmetics).toContain("opgod-armour");
    expect(state.weaponSkins).toHaveLength(1);
    expect(state.avatarCustomizationUnlocked).toBe(true);
    expect(applyEconomyAction(state, { kind: "lottery" }, () => 0).state.credits).toBe(0);
  });
  it("cannot be enabled through a legacy seed", () => {
    const state = freshEconomy({ unlimitedMoney: true, redeemedCodes: ["INFMONEOWNERONLY"] });
    expect(state.unlimitedMoney).toBe(false);
    expect(state.redeemedCodes).toEqual([]);
  });
});

describe("economy balance and purchases", () => {
  it("charges catalogue prices and refuses unaffordable purchases", () => {
    const seed = freshEconomy({ credits: 500 });
    const result = applyEconomyAction(seed, { kind: "weapon", id: "longbow-sniper" });
    expect(result.state.credits).toBe(500 - WEAPONS["longbow-sniper"].price);
    expect(
      applyEconomyAction(result.state, { kind: "weapon", id: "longbow-sniper" }).state.credits,
    ).toBe(result.state.credits);
    expect(() =>
      applyEconomyAction(freshEconomy(), { kind: "weapon", id: "longbow-sniper" }),
    ).toThrow("more credits");
  });
  it("raises costs and reduces coin rewards without changing XP", () => {
    expect(WEAPON_CRATES.map((crate) => crate.price)).toEqual([
      125, 313, 625, 1125, 1875, 3125, 5000,
    ]);
    expect(LOTTERY_PRICE).toBe(125);
    expect(AVATAR_PRICE).toBe(1250);
    expect([waveCredits("easy"), waveCredits("normal"), waveCredits("hard")]).toEqual([15, 26, 41]);
    expect(DUNGEON_CLEAR_CREDITS).toBe(75);
  });
  it("refunds completed crate collections without charging", () => {
    let state = freshEconomy({ credits: 1000 });
    for (let i = 0; i < 3; i++)
      state = applyEconomyAction(state, { kind: "crate", id: "common" }, () => 0).state;
    const result = applyEconomyAction(state, { kind: "crate", id: "common" });
    expect(result.refunded).toBe(true);
    expect(result.state.credits).toBe(state.credits);
  });
  it("rejects replayed waves and pays the reduced completion bonus once", () => {
    let state = freshEconomy();
    for (let wave = 1; wave <= 5; wave++) {
      state = applyEconomyAction(
        state,
        {
          kind: "wave",
          difficulty: "easy",
          wave,
          runId: wave === 1 ? null : "run",
          mode: "dungeon",
        },
        Math.random,
        wave * 6000,
        "run",
      ).state;
    }
    expect(state.credits).toBe(150);
    expect(() =>
      applyEconomyAction(
        state,
        { kind: "wave", difficulty: "easy", wave: 5, runId: "run", mode: "dungeon" },
        Math.random,
        40000,
      ),
    ).toThrow("in order");
  });
});
