import { describe, expect, it } from "vitest";
import { DRILLS, DRILL_IDS, drillSpawnRadius, drillTargetCount } from "./drills";

describe("training drills", () => {
  it("offers Range, Long Shots and Bot Duel", () => {
    expect(DRILL_IDS).toEqual(["range", "longshots", "bots"]);
  });
  it("Range is the 60-second moving-dummy drill", () => {
    expect(DRILLS.range.seconds).toBe(60);
    expect(DRILLS.range.moving).toBe(true);
    expect(DRILLS.range.armed).toBe(false);
  });
  it("Bot Duel fights 1 to 3 armed bots", () => {
    expect(drillTargetCount("bots", 1)).toBe(1);
    expect(drillTargetCount("bots", 3)).toBe(2);
    expect(drillTargetCount("bots", 5)).toBe(3);
    expect(DRILLS.bots.armed).toBe(true);
  });
  it("Long Shots targets stand still and spawn at least 28 m away", () => {
    expect(DRILLS.longshots.moving).toBe(false);
    expect(drillSpawnRadius("longshots", 0)).toBe(28);
    expect(drillSpawnRadius("longshots", 1)).toBe(37);
  });
  it("Range keeps the original dummy count of 3 + level", () => {
    expect(drillTargetCount("range", 1)).toBe(4);
    expect(drillTargetCount("range", 5)).toBe(8);
  });
});
