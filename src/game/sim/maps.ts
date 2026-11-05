// Map presets — pure data. The scene component reads this and draws it;
// nothing here imports three.js or React.

export type MapId = "desert" | "neon" | "frozen";

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
  },
};

export const MAP_IDS = Object.keys(MAPS) as MapId[];

export function isMapId(v: string): v is MapId {
  return v in MAPS;
}
