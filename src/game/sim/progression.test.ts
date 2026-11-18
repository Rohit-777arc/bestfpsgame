import { describe, expect, it } from "vitest";
import {
  addExperience,
  DUNGEON_WAVES,
  enemyExperience,
  experienceRequiredForLevel,
  totalExperience,
  waveExperience,
} from "./progression";

describe("player experience", () => {
  it("carries overflow through multiple levels", () => {
    expect(addExperience({ level: 1, experience: 90 }, 230)).toEqual({
      level: 3,
      experience: 95,
    });
  });

  it("does not grant negative experience", () => {
    expect(addExperience({ level: 2, experience: 15 }, -10)).toEqual({
      level: 2,
      experience: 15,
    });
    expect(experienceRequiredForLevel(1)).toBe(100);
    expect(experienceRequiredForLevel(2)).toBe(125);
    expect(experienceRequiredForLevel(3)).toBe(150);
  });

  it("calculates lifetime experience with the increasing level curve", () => {
    expect(totalExperience({ level: 3, experience: 25 })).toBe(250);
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
