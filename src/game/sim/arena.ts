// Shared arena layout — the scene draws it, movement collision reads it.
import { ARENA } from "./waves";

export { ARENA };

export const CRATES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const r = 10 + (i % 3) * 7;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1.5 + (i % 2) };
});

export const BARRELS = Array.from({ length: 14 }, (_, i) => [
  Math.cos(i * 2.4) * (6 + i * 2),
  Math.sin(i * 2.4) * (6 + i * 2),
]);

export const WALLS: { x: number; z: number; ry: number }[] = [
  { x: 0, z: -ARENA - 1, ry: 0 },
  { x: 0, z: ARENA + 1, ry: 0 },
  { x: -ARENA - 1, z: 0, ry: Math.PI / 2 },
  { x: ARENA + 1, z: 0, ry: Math.PI / 2 },
];
