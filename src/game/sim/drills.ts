// Training drills — pure data, no React/three. Brought over from Dead Center.

export type DrillId = "range" | "longshots" | "bots";

export interface DrillDef {
  id: DrillId;
  name: string;
  tag: string;
  seconds: number;
  minRadius: number;
  maxRadius: number;
  moving: boolean;
  /** Armed bots chase and shoot back. */
  armed: boolean;
}

export const DRILLS: Record<DrillId, DrillDef> = {
  range: {
    id: "range",
    name: "Range",
    tag: "Hit as many moving dummies as you can in 60 s.",
    seconds: 60,
    minRadius: 10,
    maxRadius: 30,
    moving: true,
    armed: false,
  },
  longshots: {
    id: "longshots",
    name: "Long Shots",
    tag: "Still targets far across the map. Snipers shine here.",
    seconds: 90,
    minRadius: 28,
    maxRadius: 37,
    moving: false,
    armed: false,
  },
  bots: {
    id: "bots",
    name: "Bot Duel",
    tag: "Fight 1–3 armed bots that chase you and shoot back.",
    seconds: 90,
    minRadius: 18,
    maxRadius: 30,
    moving: true,
    armed: true,
  },
};

export const DRILL_IDS = Object.keys(DRILLS) as DrillId[];

/** How many targets are on the field at once for a speed level 1..5. */
export function drillTargetCount(drill: DrillId, level: number): number {
  const lvl = Math.min(5, Math.max(1, Math.round(level)));
  if (drill === "bots") return Math.min(3, 1 + Math.floor((lvl - 1) / 2));
  if (drill === "longshots") return 3 + Math.ceil(lvl / 2);
  return 3 + lvl;
}

/** Spawn distance from the arena centre for a drill, given a 0..1 roll. */
export function drillSpawnRadius(drill: DrillId, roll: number): number {
  const d = DRILLS[drill];
  return d.minRadius + (d.maxRadius - d.minRadius) * Math.min(1, Math.max(0, roll));
}
