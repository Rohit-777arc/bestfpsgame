import { describe, expect, it } from "vitest";
import {
  LOTTERY_PRIZES,
  WEAPON_CRATES,
  WEAPON_SKIN_RARITIES,
  WEAPON_SKINS,
  rollLottery,
  rollWeaponSkin,
} from "./gacha";

describe("weapon crates", () => {
  it("offers a crate and at least one skin for every rarity", () => {
    expect(WEAPON_CRATES.map((crate) => crate.rarity)).toEqual([...WEAPON_SKIN_RARITIES]);
    for (const rarity of WEAPON_SKIN_RARITIES) {
      expect(WEAPON_SKINS.some((skin) => skin.rarity === rarity)).toBe(true);
    }
  });

  it("always awards a skin matching the crate rarity", () => {
    for (const rarity of WEAPON_SKIN_RARITIES) {
      const skinId = rollWeaponSkin(rarity, () => 0.999);
      expect(WEAPON_SKINS.find((skin) => skin.id === skinId)?.rarity).toBe(rarity);
    }
  });

  it("does not award duplicates when a guest already owns a skin from that rarity", () => {
    const owned = WEAPON_SKINS.filter((skin) => skin.rarity === "common").slice(0, 2);
    expect(
      rollWeaponSkin(
        "common",
        () => 0,
        owned.map((skin) => skin.id),
      ),
    ).not.toBe(owned[0]?.id);
  });
});

describe("coin lottery", () => {
  it("uses a complete, bounded prize distribution", () => {
    expect(LOTTERY_PRIZES.reduce((total, prize) => total + prize.chance, 0)).toBeCloseTo(1);
    expect(rollLottery(() => 0)).toBe(0);
    expect(rollLottery(() => 0.35)).toBe(50);
    expect(rollLottery(() => 0.88)).toBe(250);
    expect(rollLottery(() => 0.97)).toBe(1_000);
    expect(rollLottery(() => 1)).toBe(1_000);
  });
});
