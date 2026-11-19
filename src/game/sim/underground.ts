// Underground room rules are independent of React and Three.
import { mulberry32 } from './waves';

export const ROOM_BOOK_CHANCE = 0.04;
export const DOOR_OPEN_SECONDS = 1.4;
export const EXIT_Z = -22.3;
export const DOOR_Z = -18;
export const ROOM_TABLES = [
  { x: -13.2, z: -3, width: 2.8, depth: 1.6 },
  { x: 13.2, z: 7, width: 3.2, depth: 1.6 },
] as const;
export const ROOM_CHESTS = [
  { x: -19, z: -12, width: 2, depth: 1.3 },
  { x: 19, z: 13, width: 2, depth: 1.3 },
  { x: 16, z: -14, width: 2, depth: 1.3 },
] as const;

export type UndergroundRoomState = { room: number; bookAvailable: boolean; doorProgress: number };
export function createUndergroundRoom(room: number, seed: number): UndergroundRoomState {
  const random = mulberry32((seed ^ Math.imul(room, 0x45d9f3b) ^ 0x73e2c9a1) >>> 0);
  return { room, bookAvailable: random() < ROOM_BOOK_CHANCE, doorProgress: 0 };
}
export function stepUndergroundRoom(state: UndergroundRoomState, dt: number, cleared: boolean): void {
  if (cleared) state.doorProgress = Math.min(1, state.doorProgress + Math.max(0, dt) / DOOR_OPEN_SECONDS);
}
export function canLeaveUndergroundRoom(state: UndergroundRoomState, x: number, z: number): boolean {
  return state.doorProgress >= 1 && Math.abs(x) < 2.4 && z < EXIT_Z;
}
export function undergroundBlocked(x: number, z: number, doorProgress: number, radius = 0.3): boolean {
  if (z < DOOR_Z + radius && (Math.abs(x) > 2.4 - radius || doorProgress < 1)) return true;
  return [...ROOM_TABLES, ...ROOM_CHESTS].some(prop =>
    Math.abs(x - prop.x) < prop.width / 2 + radius && Math.abs(z - prop.z) < prop.depth / 2 + radius);
}
export function undergroundFloorHeight(x: number, z: number): number {
  if (Math.abs(x) >= 2.4 || z > -19.5) return 0;
  return Math.min(0.8, Math.floor((-z - 19.5) / 0.65 + 1) * 0.2);
}
