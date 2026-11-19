import { describe, expect, it } from 'vitest';
import { createUndergroundRoom, stepUndergroundRoom, canLeaveUndergroundRoom, undergroundBlocked, undergroundFloorHeight, DOOR_OPEN_SECONDS, ROOM_TABLES, ROOM_CHESTS } from './underground';
import { isFinalDungeonWave } from './progression';
import { undergroundSpawnPlan } from './waves';

describe('endless underground rooms', () => {
  it('never completes underground at five or later rooms while gunfight still ends at five', () => {
    for (const room of [1, 5, 6, 999, 10000, 1000000]) {
      expect(isFinalDungeonWave('dungeon', room, 'underground')).toBe(false);
      const plan = undergroundSpawnPlan('normal', room, 123);
      expect(plan.length).toBeGreaterThan(0);
      expect(plan.length).toBeLessThanOrEqual(20);
    }
    expect(isFinalDungeonWave('dungeon', 4, 'gunfight')).toBe(false);
    expect(isFinalDungeonWave('dungeon', 5, 'gunfight')).toBe(true);
    expect(isFinalDungeonWave('coop', 5)).toBe(false);
  });
  it('rolls room books once deterministically and keeps them rare', () => {
    let books = 0;
    for (let room = 1; room <= 10000; room++) {
      const result = createUndergroundRoom(room, 7123);
      expect(result).toEqual(createUndergroundRoom(room, 7123));
      if (result.bookAvailable) books++;
    }
    expect(books).toBeGreaterThan(300);
    expect(books).toBeLessThan(500);
  });
});

describe('room exit doors', () => {
  it('stays closed during combat and opens only over the full animation', () => {
    const room = createUndergroundRoom(1, 1);
    stepUndergroundRoom(room, 20, false);
    expect(room.doorProgress).toBe(0);
    expect(undergroundBlocked(0, -18.5, room.doorProgress)).toBe(true);
    stepUndergroundRoom(room, DOOR_OPEN_SECONDS / 2, true);
    expect(room.doorProgress).toBe(.5);
    expect(canLeaveUndergroundRoom(room, 0, -23)).toBe(false);
    stepUndergroundRoom(room, DOOR_OPEN_SECONDS / 2, true);
    expect(room.doorProgress).toBe(1);
    expect(undergroundBlocked(0, -18.5, room.doorProgress)).toBe(false);
    expect(canLeaveUndergroundRoom(room, 0, -23)).toBe(true);
    expect(canLeaveUndergroundRoom(room, 5, -23)).toBe(false);
    expect(canLeaveUndergroundRoom(room, 0, -15)).toBe(false);
    stepUndergroundRoom(room, 100, true);
    expect(room.doorProgress).toBe(1);
    expect(createUndergroundRoom(2, 2).doorProgress).toBe(0);
  });
  it('gives furniture and the exit walls collision but keeps the central route clear', () => {
    for (const prop of [...ROOM_TABLES, ...ROOM_CHESTS]) expect(undergroundBlocked(prop.x, prop.z, 1)).toBe(true);
    expect(undergroundBlocked(0, 0, 0)).toBe(false);
    expect(undergroundBlocked(0, -16, 0)).toBe(false);
    expect(undergroundBlocked(5, -19, 1)).toBe(true);
    expect(undergroundFloorHeight(0, -20)).toBeGreaterThan(0);
    expect(undergroundFloorHeight(0, -23)).toBe(.8);
  });
});
