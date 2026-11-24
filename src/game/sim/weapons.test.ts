import { describe, expect, it } from "vitest";
import {
  closeRangeMultiplier,
  damagePerShot,
  isWeaponId,
  shotInterval,
  splashDamage,
  STARTER_WEAPON,
  WEAPONS,
  WEAPON_IDS,
  weaponRange,
} from "./weapons";

describe("weapon catalogue", () => {
  it("keeps the original 5 Mexican Standof weapons", () => {
    const originals = WEAPON_IDS.filter((id) => WEAPONS[id].collection === "standof");
    expect(originals).toEqual(["scout-pistol", "vector-smg", "riot-shotgun", "marksman-rifle", "longbow-sniper"]);
  });
  it("adds the 13 blaster guns from Dead Center", () => {
    expect(WEAPON_IDS.filter((id) => WEAPONS[id].collection === "blasters").length).toBe(13);
  });
  it("the starter pistol is the only free weapon", () => {
    expect(WEAPONS[STARTER_WEAPON].price).toBe(0);
    for (const id of WEAPON_IDS) {
      if (id !== STARTER_WEAPON) expect(WEAPONS[id].price).toBeGreaterThan(0);
    }
  });
  it("every weapon can shoot, and only the Confetti Cannon does no damage", () => {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w.pellets).toBeGreaterThan(0);
      expect(w.mag).toBeGreaterThan(0);
      expect(w.reloadTime).toBeGreaterThan(0);
      expect(shotInterval(w)).toBeGreaterThan(0);
      expect(w.damage === 0).toBe(id === "confetti-cannon");
    }
  });
  it("the two snipers are the only scoped weapons", () => {
    for (const id of WEAPON_IDS) {
      expect(WEAPONS[id].scope).toBe(id === "longbow-sniper" || id === "long-block");
    }
    expect(damagePerShot(WEAPONS["longbow-sniper"])).toBeGreaterThan(damagePerShot(WEAPONS["marksman-rifle"]));
  });
  it("the SMG is fully automatic", () => {
    expect(WEAPONS["vector-smg"].auto).toBe(true);
    expect(WEAPONS["scout-pistol"].auto).toBe(false);
  });
  it("Blaze Hose burns at short range, Frost Ray freezes", () => {
    expect(WEAPONS["blaze-hose"].effect).toBe("burn");
    expect(weaponRange(WEAPONS["blaze-hose"])).toBe(9);
    expect(WEAPONS["frost-ray"].effect).toBe("freeze");
    expect(weaponRange(WEAPONS["ak-47"])).toBe(160);
  });
  it("Boom Tube splash falls off and stops at 3.2 m", () => {
    const tube = WEAPONS["boom-tube"];
    expect(splashDamage(tube, 0)).toBe(140);
    expect(splashDamage(tube, 3.2)).toBe(56);
    expect(splashDamage(tube, 3.3)).toBe(0);
    expect(splashDamage(WEAPONS["ak-47"], 0)).toBe(0);
  });
  it("Cube SMG deals 2.2x point-blank, fading to 1x at 16 m", () => {
    const smg = WEAPONS["cube-smg"];
    expect(closeRangeMultiplier(smg, 3)).toBe(2.2);
    expect(closeRangeMultiplier(smg, 16)).toBe(1);
    expect(closeRangeMultiplier(smg, 11)).toBeCloseTo(1.6);
    expect(closeRangeMultiplier(WEAPONS["ak-47"], 1)).toBe(1);
  });
  it("validates weapon ids", () => {
    expect(isWeaponId("vector-smg")).toBe(true);
    expect(isWeaponId("ak-47")).toBe(true);
    expect(isWeaponId("nuke")).toBe(false);
  });
});
