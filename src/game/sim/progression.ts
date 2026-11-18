export interface PlayerExperience {
  level: number;
  experience: number;
}

export const EXPERIENCE_PER_LEVEL = 100;
export const EXPERIENCE_INCREASE_PER_LEVEL = 25;
export const DUNGEON_WAVES = 5;
export const DUNGEON_CLEAR_CREDITS = 50;
export const DUNGEON_CLEAR_EXPERIENCE = 100;

export const ENEMY_EXPERIENCE = {
  grunt: 30,
  runner: 45,
  brute: 75,
} as const;

export function experienceRequiredForLevel(level: number): number {
  return (
    EXPERIENCE_PER_LEVEL + (Math.max(1, Math.floor(level)) - 1) * EXPERIENCE_INCREASE_PER_LEVEL
  );
}

export function totalExperience(progress: PlayerExperience): number {
  const completedLevels = Math.max(0, Math.floor(progress.level) - 1);
  return (
    completedLevels * EXPERIENCE_PER_LEVEL +
    (completedLevels * (completedLevels - 1) * EXPERIENCE_INCREASE_PER_LEVEL) / 2 +
    Math.max(0, Math.floor(progress.experience))
  );
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
