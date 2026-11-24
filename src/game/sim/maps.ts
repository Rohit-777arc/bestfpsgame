// Map presets — pure data. The scene component reads this and draws it;
// nothing here imports three.js or React.

export type MapId = "desert" | "neon" | "frozen" | "jungle" | "lava";

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  night: boolean;
  sky: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  envFill: string; // lightformer color
  groundBase: string;
  groundFleck: number; // texture noise amplitude
  wallColor: string;
  crateColor: string;
  crateAccent: string;
  barrelColors: [string, string];
  neonSigns: boolean;
  snow: boolean;
  trees: boolean; // jungle canopy
  lava: boolean; // glowing lava pools and stone pillars
}

export const MAPS: Record<MapId, MapDef> = {
  desert: {
    id: "desert",
    name: "Desert Dunes",
    blurb: "The original training range. Hot sun, dusty haze.",
    night: false,
    sky: "#d9c3a0",
    fog: "#d9c3a0",
    fogNear: 15,
    fogFar: 85,
    sunColor: "#fff1da",
    sunIntensity: 2.6,
    sunPos: [25, 35, 12],
    hemiSky: "#ffe2b8",
    hemiGround: "#7a5230",
    hemiIntensity: 0.6,
    envFill: "#ffcc99",
    groundBase: "#c9a36b",
    groundFleck: 20,
    wallColor: "#a0704a",
    crateColor: "#8a5a2b",
    crateAccent: "#5a3818",
    barrelColors: ["#5d6b4a", "#7a3b2a"],
    neonSigns: false,
    snow: false,
    trees: false,
    lava: false,
  },
  neon: {
    id: "neon",
    name: "Neon Night",
    blurb: "A dark city block lit by buzzing signs.",
    night: true,
    sky: "#0b0d1a",
    fog: "#0b0d1a",
    fogNear: 10,
    fogFar: 70,
    sunColor: "#6a7dff",
    sunIntensity: 0.7,
    sunPos: [-18, 28, -10],
    hemiSky: "#2a2f5e",
    hemiGround: "#0a0a12",
    hemiIntensity: 0.5,
    envFill: "#4a5aff",
    groundBase: "#1c1f2b",
    groundFleck: 8,
    wallColor: "#232633",
    crateColor: "#2e3242",
    crateAccent: "#111420",
    barrelColors: ["#3d4257", "#57203a"],
    neonSigns: true,
    snow: false,
    trees: false,
    lava: false,
  },
  frozen: {
    id: "frozen",
    name: "Frozen Base",
    blurb: "Snow, ice crates and cold blue light.",
    night: false,
    sky: "#cfe0ee",
    fog: "#cfe0ee",
    fogNear: 12,
    fogFar: 80,
    sunColor: "#eaf4ff",
    sunIntensity: 2.0,
    sunPos: [20, 32, -14],
    hemiSky: "#dff0ff",
    hemiGround: "#8fa8bd",
    hemiIntensity: 0.8,
    envFill: "#bcd8ee",
    groundBase: "#e6edf2",
    groundFleck: 10,
    wallColor: "#9fb3c2",
    crateColor: "#b9d2e2",
    crateAccent: "#7e99ab",
    barrelColors: ["#6d8496", "#8a4b3c"],
    neonSigns: false,
    snow: true,
    trees: false,
    lava: false,
  },
  jungle: {
    id: "jungle",
    name: "Jungle Tower",
    blurb: "Mossy ruins under a thick canopy of giant trees.",
    night: false,
    sky: "#a9c79a",
    fog: "#9dbb8e",
    fogNear: 10,
    fogFar: 70,
    sunColor: "#fff4cf",
    sunIntensity: 2.2,
    sunPos: [18, 34, 10],
    hemiSky: "#d8f0c0",
    hemiGround: "#2e4220",
    hemiIntensity: 0.8,
    envFill: "#b6e09a",
    groundBase: "#4f6b32",
    groundFleck: 18,
    wallColor: "#5f6b4a",
    crateColor: "#6b5436",
    crateAccent: "#3c2e1c",
    barrelColors: ["#4b5d33", "#6b3d24"],
    neonSigns: false,
    snow: false,
    trees: true,
    lava: false,
  },
  lava: {
    id: "lava",
    name: "Lava Temple",
    blurb: "Pillared ruins beside glowing lava pools.",
    night: true,
    sky: "#2a1410",
    fog: "#3a1a10",
    fogNear: 12,
    fogFar: 72,
    sunColor: "#ffb27a",
    sunIntensity: 1.4,
    sunPos: [-20, 30, 14],
    hemiSky: "#ff9a5c",
    hemiGround: "#1a0c08",
    hemiIntensity: 0.7,
    envFill: "#ff7a3a",
    groundBase: "#3b2a24",
    groundFleck: 14,
    wallColor: "#4a3530",
    crateColor: "#5a3d30",
    crateAccent: "#2a1a14",
    barrelColors: ["#5a3328", "#7a2a18"],
    neonSigns: false,
    snow: false,
    trees: false,
    lava: true,
  },
};

export const MAP_IDS = Object.keys(MAPS) as MapId[];

export function isMapId(v: string): v is MapId {
  return v in MAPS;
}
