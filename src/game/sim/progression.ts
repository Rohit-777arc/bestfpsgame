export interface PlayerExperience {
  level: number;
  experience: number;
}

export const EXPERIENCE_PER_LEVEL = 100;
export const EXPERIENCE_INCREASE_PER_LEVEL = 50;
export const DUNGEON_WAVES = 5;
export const DUNGEON_CLEAR_CREDITS = 100;
export const DUNGEON_CLEAR_EXPERIENCE = 100;

export const ENEMY_EXPERIENCE = {
  grunt: 30,
  runner: 45,
  brute: 75,
  enchanter: 100,
} as const;

export const PLAYER_RANKS = [
  { name: "BRONZE III", minExperience: 0 },
  { name: "BRONZE II", minExperience: 100 },
  { name: "BRONZE I", minExperience: 250 },
  { name: "SILVER III", minExperience: 450 },
  { name: "SILVER II", minExperience: 750 },
  { name: "SILVER I", minExperience: 1_200 },
  { name: "GOLD III", minExperience: 1_800 },
  { name: "GOLD II", minExperience: 2_600 },
  { name: "GOLD I", minExperience: 3_700 },
  { name: "DIAMOND IV", minExperience: 5_200 },
  { name: "DIAMOND III", minExperience: 7_500 },
  { name: "DIAMOND II", minExperience: 11_000 },
  { name: "DIAMOND I", minExperience: 16_000 },
  { name: "PLATINUM II", minExperience: 24_000 },
  { name: "PLATINUM I", minExperience: 36_000 },
  { name: "RUBY I", minExperience: 55_000 },
  { name: "BESTFPSGAMEPLAYER 6", minExperience: 85_000 },
  { name: "BESTFPSGAMEPLAYER 5", minExperience: 135_000 },
  { name: "BESTFPSGAMEPLAYER 4", minExperience: 220_000 },
  { name: "BESTFPSGAMEPLAYER 3", minExperience: 365_000 },
  { name: "BESTFPSGAMEPLAYER 2", minExperience: 620_000 },
  { name: "BESTFPSGAMEPLAYER 1", minExperience: 1_000_000 },
] as const;

export type PlayerRank = (typeof PLAYER_RANKS)[number];

export function rankForExperience(totalExperience: number): {
  name: string;
  minExperience: number;
  nextMinExperience: number | null;
  progress: number;
} {
  const experience = Math.max(0, Math.floor(totalExperience));
  let rankIndex = 0;
  for (let index = 1; index < PLAYER_RANKS.length; index++) {
    if (experience < PLAYER_RANKS[index]!.minExperience) break;
    rankIndex = index;
  }
  const rank = PLAYER_RANKS[rankIndex]!;
  const next = PLAYER_RANKS[rankIndex + 1];
  if (!next) return { ...rank, nextMinExperience: null, progress: 1 };
  const progress = (experience - rank.minExperience) / (next.minExperience - rank.minExperience);
  return { ...rank, nextMinExperience: next.minExperience, progress };
}

export function experienceRequiredForLevel(level: number): number {
  const completedLevels = Math.max(0, Math.floor(level) - 1);
  return EXPERIENCE_PER_LEVEL + EXPERIENCE_INCREASE_PER_LEVEL * completedLevels + 2 * completedLevels ** 2;
}

export function totalExperience(progress: PlayerExperience): number {
  const completedLevels = Math.max(0, Math.floor(progress.level) - 1);
  const levelExperience =
    completedLevels * EXPERIENCE_PER_LEVEL +
    (EXPERIENCE_INCREASE_PER_LEVEL * completedLevels * (completedLevels - 1)) / 2 +
    (completedLevels * (completedLevels - 1) * (2 * completedLevels - 1)) / 3;
  return Math.floor(levelExperience + Math.max(0, Math.floor(progress.experience)));
}

export function enemyExperience(tier: keyof typeof ENEMY_EXPERIENCE): number {
  return ENEMY_EXPERIENCE[tier];
}

export function waveExperience(difficulty: "easy" | "normal" | "hard"): number {
  return difficulty === "hard" ? 30 : difficulty === "normal" ? 20 : 15;
}

export function addExperience(progress: PlayerExperience, amount: number): PlayerExperience {
  let level = Math.max(1, Math.floor(progress.level) || 1);
  let experience =
    Math.max(0, Math.floor(progress.experience) || 0) + Math.max(0, Math.floor(amount) || 0);

  while (experience >= experienceRequiredForLevel(level)) {
    experience -= experienceRequiredForLevel(level);
    level++;
  }

  return { level, experience };
}
