// Dungeon wave rules — pure functions. Payouts and scaling live here so both
// the game and the credits server function agree on the numbers.

export type Difficulty = "easy" | "normal" | "hard";
export type Tier = "grunt" | "runner" | "brute";

export interface DifficultyDef {
  id: Difficulty;
  label: string;
  creditsPerWave: number;
  baseEnemies: number;
  enemiesPerWave: number;
  maxEnemies: number;
  hpMul: number;
  dmgMul: number;
  speedMul: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: "easy",
    label: "Easy",
    creditsPerWave: 5,
    baseEnemies: 3,
    enemiesPerWave: 1,
    maxEnemies: 9,
    hpMul: 0.8,
    dmgMul: 0.7,
    speedMul: 0.9,
  },
  normal: {
    id: "normal",
    label: "Normal",
    creditsPerWave: 10,
    baseEnemies: 4,
    enemiesPerWave: 2,
    maxEnemies: 12,
    hpMul: 1,
    dmgMul: 1,
    speedMul: 1,
  },
  hard: {
    id: "hard",
    label: "Hard",
    creditsPerWave: 20,
    baseEnemies: 5,
    enemiesPerWave: 3,
    maxEnemies: 14,
    hpMul: 1.3,
    dmgMul: 1.4,
    speedMul: 1.15,
  },
};

export interface TierDef {
  id: Tier;
  label: string;
  hp: number;
  speed: number; // m/s
  damage: number; // per melee hit
  reach: number; // m at which it can hit the player
  reward: number; // bonus credits on a full run (kept for stats)
}

export const TIERS: Record<Tier, TierDef> = {
  grunt: { id: "grunt", label: "Grunt", hp: 100, speed: 2.6, damage: 8, reach: 1.6, reward: 1 },
  runner: { id: "runner", label: "Runner", hp: 60, speed: 5.2, damage: 5, reach: 1.4, reward: 2 },
  brute: { id: "brute", label: "Brute", hp: 240, speed: 1.7, damage: 20, reach: 2.0, reward: 4 },
};

/** Total enemies in a dungeon wave. */
export function enemyCountForWave(diff: Difficulty, wave: number): number {
  const d = DIFFICULTIES[diff];
  return Math.min(d.maxEnemies, d.baseEnemies + (wave - 1) * d.enemiesPerWave);
}

/**
 * Tier mix for a wave. Early waves are grunts; runners join from wave 3,
 * brutes join from wave 5 and appear every wave after.
 */
export function tierMixForWave(diff: Difficulty, wave: number): Tier[] {
  const n = enemyCountForWave(diff, wave);
  const out: Tier[] = [];
  for (let i = 0; i < n; i++) {
    if (wave >= 5 && i % 4 === 3) out.push("brute");
    else if (wave >= 3 && i % 3 === 2) out.push("runner");
    else out.push("grunt");
  }
  return out;
}

/** Credits paid out for clearing one wave. */
export function waveCredits(diff: Difficulty): number {
  return DIFFICULTIES[diff].creditsPerWave;
}

/** Total credits a full run of `waves` cleared waves pays. */
export function runCredits(diff: Difficulty, waves: number): number {
  return waveCredits(diff) * Math.max(0, waves);
}

/** Effective enemy stats after difficulty scaling. */
export function scaledTier(diff: Difficulty, tier: Tier): TierDef {
  const d = DIFFICULTIES[diff];
  const t = TIERS[tier];
  return {
    ...t,
    hp: Math.round(t.hp * d.hpMul),
    speed: t.speed * d.speedMul,
    damage: Math.max(1, Math.round(t.damage * d.dmgMul)),
  };
}

// ---- Seeded spawns (keeps co-op waves identical on every client) ----

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ARENA = 40;

export interface EnemySpawn {
  id: number;
  tier: Tier;
  x: number;
  z: number;
}

/** Deterministic spawn positions and tier mix for one wave. */
export function spawnPlan(diff: Difficulty, wave: number, seed: number): EnemySpawn[] {
  const mix = tierMixForWave(diff, wave);
  const rnd = mulberry32(seed);
  return mix.map((tier, i) => {
    const a = rnd() * Math.PI * 2;
    const r = 14 + rnd() * 22;
    return { id: i, tier, x: Math.cos(a) * r, z: Math.sin(a) * r };
  });
}
