import { describe, expect, it } from "vitest";
import { isMapId, MAPS, MAP_IDS } from "./maps";

describe("map presets", () => {
  it("has exactly 3 maps", () => {
    expect(MAP_IDS.length).toBe(3);
  });
  it("contains the three named maps", () => {
    expect(MAPS.desert.name).toBe("Desert Dunes");
    expect(MAPS.neon.name).toBe("Neon Night");
    expect(MAPS.frozen.name).toBe("Frozen Base");
  });
  it("only Neon Night is a night map with signs", () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].night).toBe(id === "neon");
      expect(MAPS[id].neonSigns).toBe(id === "neon");
    }
  });
  it("only Frozen Base has snow", () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].snow).toBe(id === "frozen");
    }
  });
  it("validates map ids", () => {
    expect(isMapId("neon")).toBe(true);
    expect(isMapId("mars")).toBe(false);
  });
});
