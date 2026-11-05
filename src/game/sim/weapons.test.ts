import { describe, expect, it } from "vitest";
import {
  damagePerShot,
  isWeaponId,
  shotInterval,
  STARTER_WEAPON,
  WEAPONS,
  WEAPON_IDS,
} from "./weapons";

describe("weapon catalogue", () => {
  it("has exactly 5 weapons", () => {
    expect(WEAPON_IDS.length).toBe(5);
  });
  it("the starter pistol is free", () => {
    expect(WEAPONS[STARTER_WEAPON].price).toBe(0);
  });
  it("every other weapon costs credits", () => {
    for (const id of WEAPON_IDS) {
      if (id === STARTER_WEAPON) continue;
      expect(WEAPONS[id].price).toBeGreaterThan(0);
    }
  });
  it("every weapon deals damage and can shoot", () => {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w.damage).toBeGreaterThan(0);
      expect(w.pellets).toBeGreaterThan(0);
      expect(w.mag).toBeGreaterThan(0);
      expect(w.reloadTime).toBeGreaterThan(0);
      expect(shotInterval(w)).toBeGreaterThan(0);
    }
  });
  it("the sniper is the only scoped weapon and hits the hardest", () => {
    expect(WEAPONS["longbow-sniper"].scope).toBe(true);
    for (const id of WEAPON_IDS) {
      expect(WEAPONS[id].scope).toBe(id === "longbow-sniper");
    }
    expect(damagePerShot(WEAPONS["longbow-sniper"])).toBeGreaterThan(
      damagePerShot(WEAPONS["marksman-rifle"]),
    );
  });
  it("the SMG is fully automatic", () => {
    expect(WEAPONS["vector-smg"].auto).toBe(true);
    expect(WEAPONS["scout-pistol"].auto).toBe(false);
  });
  it("validates weapon ids", () => {
    expect(isWeaponId("vector-smg")).toBe(true);
    expect(isWeaponId("nuke")).toBe(false);
  });
});
