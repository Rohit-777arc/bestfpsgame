import { describe, expect, it } from "vitest";
import { isMapId, MAPS, MAP_IDS } from "./maps";

describe("map presets", () => {
  it("keeps the original 3 maps and adds 2 from Dead Center", () => {
    expect(MAP_IDS).toEqual(["desert", "neon", "frozen", "jungle", "lava"]);
  });
  it("contains the named maps", () => {
    expect(MAPS.desert.name).toBe("Desert Dunes");
    expect(MAPS.neon.name).toBe("Neon Night");
    expect(MAPS.frozen.name).toBe("Frozen Base");
    expect(MAPS.jungle.name).toBe("Jungle Tower");
    expect(MAPS.lava.name).toBe("Lava Temple");
  });
  it("only Neon Night has signs", () => {
    for (const id of MAP_IDS) expect(MAPS[id].neonSigns).toBe(id === "neon");
  });
  it("only Frozen Base has snow, only Jungle has trees, only Lava Temple has lava", () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].snow).toBe(id === "frozen");
      expect(MAPS[id].trees).toBe(id === "jungle");
      expect(MAPS[id].lava).toBe(id === "lava");
    }
  });
  it("validates map ids", () => {
    expect(isMapId("neon")).toBe(true);
    expect(isMapId("lava")).toBe(true);
    expect(isMapId("mars")).toBe(false);
  });
});
