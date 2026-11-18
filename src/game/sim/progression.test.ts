import { describe, expect, it } from "vitest";
import {
  addExperience,
  DUNGEON_WAVES,
  enemyExperience,
  experienceRequiredForLevel,
  PLAYER_RANKS,
  rankForExperience,
  totalExperience,
  waveExperience,
} from "./progression";

describe("player experience", () => {
  it("carries overflow through multiple levels", () => {
    expect(addExperience({ level: 1, experience: 90 }, 230)).toEqual({
      level: 3,
      experience: 68,
    });
  });

  it("does not grant negative experience", () => {
    expect(addExperience({ level: 2, experience: 15 }, -10)).toEqual({
      level: 2,
      experience: 15,
    });
    expect(experienceRequiredForLevel(1)).toBe(100);
    expect(experienceRequiredForLevel(2)).toBe(152);
    expect(experienceRequiredForLevel(3)).toBe(208);
    expect(experienceRequiredForLevel(4)).toBeGreaterThan(experienceRequiredForLevel(3));
    expect(experienceRequiredForLevel(25)).toBeGreaterThan(experienceRequiredForLevel(24));
  });

  it("calculates lifetime experience with the increasing level curve", () => {
    expect(totalExperience({ level: 3, experience: 25 })).toBe(277);
  });

  it("uses 22 increasingly difficult ranks and caps at the top rank", () => {
    expect(PLAYER_RANKS).toHaveLength(22);
    expect(rankForExperience(0).name).toBe("BRONZE III");
    expect(rankForExperience(100).name).toBe("BRONZE II");
    expect(rankForExperience(1_000_000).name).toBe("BESTFPSGAMEPLAYER 1");
    expect(rankForExperience(1_000_000).nextMinExperience).toBeNull();
    const steps = PLAYER_RANKS.slice(1).map(
      (rank, index) => rank.minExperience - PLAYER_RANKS[index]!.minExperience,
    );
    expect(steps.every((step, index) => index === 0 || step > steps[index - 1]!)).toBe(true);
  });

  it("defines finite dungeon completion rewards", () => {
    expect(DUNGEON_WAVES).toBe(5);
    expect(waveExperience("easy")).toBeGreaterThan(0);
    expect(waveExperience("hard")).toBeGreaterThan(waveExperience("easy"));
    expect(enemyExperience("grunt")).toBe(30);
    expect(enemyExperience("runner")).toBeGreaterThan(enemyExperience("grunt"));
    expect(enemyExperience("brute")).toBeGreaterThan(enemyExperience("runner"));
  });
});
