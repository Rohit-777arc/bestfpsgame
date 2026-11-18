import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  enemyBehaviorForWave,
  enemyCountForWave,
  runCredits,
  scaledUndergroundTier,
  scaledTier,
  tierMixForWave,
  undergroundSpawnPlan,
  undergroundZombieCount,
  waveCredits,
} from "./waves";

// The credit payouts the user set: Easy 5, Normal 10, Hard 20 per wave.
describe("wave credit payouts", () => {
  it("pays 5 credits per easy wave", () => {
    expect(waveCredits("easy")).toBe(5);
  });
  it("pays 10 credits per normal wave", () => {
    expect(waveCredits("normal")).toBe(10);
  });
  it("pays 20 credits per hard wave", () => {
    expect(waveCredits("hard")).toBe(20);
  });
  it("harder difficulties never pay less than easier ones", () => {
    expect(DIFFICULTIES.hard.creditsPerWave).toBeGreaterThan(DIFFICULTIES.normal.creditsPerWave);
    expect(DIFFICULTIES.normal.creditsPerWave).toBeGreaterThan(DIFFICULTIES.easy.creditsPerWave);
  });
  it("sums full-run payouts", () => {
    expect(runCredits("easy", 4)).toBe(20);
    expect(runCredits("hard", 3)).toBe(60);
    expect(runCredits("normal", 0)).toBe(0);
  });
});

describe("wave scaling", () => {
  it("starts small and grows with the wave", () => {
    expect(enemyCountForWave("normal", 1)).toBeLessThan(enemyCountForWave("normal", 3));
    expect(enemyCountForWave("normal", 1)).toBeGreaterThan(0);
  });
  it("never exceeds the per-difficulty cap", () => {
    for (const diff of ["easy", "normal", "hard"] as const) {
      for (let w = 1; w <= 30; w++) {
        expect(enemyCountForWave(diff, w)).toBeLessThanOrEqual(DIFFICULTIES[diff].maxEnemies);
      }
    }
  });
  it("hard throws more enemies at wave 1 than easy", () => {
    expect(enemyCountForWave("hard", 1)).toBeGreaterThan(enemyCountForWave("easy", 1));
  });
  it("early waves are grunts only, later waves mix tiers", () => {
    expect(tierMixForWave("normal", 1).every((t) => t === "grunt")).toBe(true);
    const late = tierMixForWave("normal", 8);
    expect(late.some((t) => t === "runner")).toBe(true);
    expect(late.some((t) => t === "brute")).toBe(true);
    expect(tierMixForWave("normal", 8).length).toBe(enemyCountForWave("normal", 8));
  });
});

describe("difficulty scaling", () => {
  it("hard brutes hit harder than easy brutes", () => {
    expect(scaledTier("hard", "brute").damage).toBeGreaterThan(scaledTier("easy", "brute").damage);
  });
  it("hard enemies have more health than easy ones", () => {
    expect(scaledTier("hard", "grunt").hp).toBeGreaterThan(scaledTier("easy", "grunt").hp);
  });
});

describe("underground rooms", () => {
  it("adds zombies as the player advances through rooms", () => {
    expect(undergroundZombieCount("normal", 2)).toBeGreaterThan(
      undergroundZombieCount("normal", 1),
    );
    expect(undergroundZombieCount("normal", 5)).toBeLessThanOrEqual(20);
  });

  it("creates deterministic zombie spawns inside the room", () => {
    const first = undergroundSpawnPlan("normal", 4, 123);
    expect(undergroundSpawnPlan("normal", 4, 123)).toEqual(first);
    expect(first).toHaveLength(undergroundZombieCount("normal", 4));
    expect(first.every(({ x, z }) => Math.hypot(x, z) <= 14)).toBe(true);
    expect(first.some(({ tier }) => tier === "runner")).toBe(true);
    expect(first.some(({ tier }) => tier === "brute")).toBe(true);
  });

  it("makes zombies tougher and faster in deeper rooms", () => {
    const early = scaledUndergroundTier("normal", "grunt", 1);
    const late = scaledUndergroundTier("normal", "grunt", 5);
    expect(late.hp).toBeGreaterThan(early.hp);
    expect(late.speed).toBeGreaterThan(early.speed);
    expect(late.damage).toBeGreaterThan(early.damage);
  });
});

describe("enemy combat progression", () => {
  it("makes enemies more accurate and faster between early dungeon waves", () => {
    const early = enemyBehaviorForWave(1);
    const later = enemyBehaviorForWave(6);
    expect(later.aimError).toBeLessThan(early.aimError);
    expect(later.attackInterval).toBeLessThan(early.attackInterval);
    expect(later.strafe).toBeGreaterThan(early.strafe);
  });

  it("keeps late-wave behavior within the same fair upper bounds", () => {
    expect(enemyBehaviorForWave(100)).toEqual(enemyBehaviorForWave(11));
    expect(enemyBehaviorForWave(1).aimError).toBeLessThanOrEqual(0.18);
    expect(enemyBehaviorForWave(100).attackInterval).toBeGreaterThanOrEqual(1.1);
    expect(enemyBehaviorForWave(100).strafe).toBeLessThanOrEqual(0.8);
  });
});
