import { describe, expect, it } from "vitest";
import { createRaceState, RACE_LAPS, RACE_TRACK_LENGTH, raceLap, stepRace, stepRival, trackPosition } from "./racing";

describe("race progress", () => {
  it("moves forward under throttle and brakes under reverse input", () => {
    const state = createRaceState();
    for (let i = 0; i < 60; i++) stepRace(state, { throttle: 1, steering: 0, nitro: false, handbrake: false }, 1 / 60);
    expect(state.distance).toBeGreaterThan(0);
    expect(state.speed).toBeGreaterThan(40);
    const distance = state.distance;
    for (let i = 0; i < 60; i++) stepRace(state, { throttle: -1, steering: 0, nitro: false, handbrake: false }, 1 / 60);
    expect(state.speed).toBeLessThan(40);
    expect(state.distance).toBeGreaterThan(distance);
  });

  it("runs exactly three laps and stops after the finish", () => {
    const state = createRaceState();
    expect(raceLap(0)).toBe(1);
    expect(raceLap(RACE_TRACK_LENGTH + 2)).toBe(2);
    for (let i = 0; i < 2000 && !state.finished; i++) {
      stepRace(state, { throttle: 1, steering: 0, nitro: true, handbrake: false }, 0.05);
    }
    expect(state.finished).toBe(true);
    expect(state.distance).toBe(RACE_TRACK_LENGTH * RACE_LAPS);
    expect(stepRace(state, { throttle: 1, steering: 0, nitro: false, handbrake: false }, 1 / 60)).toEqual([]);
  });

  it("picks up nitro at each lap's ramp and caps the tank", () => {
    const state = createRaceState();
    state.distance = 68;
    state.speed = 150;
    state.nitro = 5;
    const events = stepRace(state, { throttle: 1, steering: 0, nitro: false, handbrake: false }, 0.05);
    expect(events).toContain("ramp");
    expect(state.nitro).toBeGreaterThan(5);
    expect(state.nitro).toBeLessThanOrEqual(100);
    expect(state.boostTime).toBeGreaterThan(0);
  });

  it("fills the drift meter while sliding and awards nitro when it completes", () => {
    const state = createRaceState();
    state.speed = 180;
    state.lateralSpeed = 8;
    state.driftMeter = 99.5;
    const events = stepRace(state, { throttle: 1, steering: 1, nitro: false, handbrake: true }, 0.05);
    expect(events).toContain("drift");
    expect(state.driftMeter).toBe(0);
    expect(state.nitro).toBeGreaterThan(0);
    expect(state.driftScore).toBeGreaterThan(0);
  });

  it("slows and reports a crash, while rivals progress independently", () => {
    const state = createRaceState();
    state.speed = 160;
    const oldDistance = state.distance;
    const crashEvents = stepRace(state, { throttle: 1, steering: 0, nitro: false, handbrake: false }, 0.05, true);
    expect(crashEvents.filter((event) => event === "wrecked")).toHaveLength(1);
    expect(state.speed).toBeLessThan(160);
    expect(state.distance).toBeGreaterThan(oldDistance);
    expect(stepRival(20, 180, 0.05)).toBeGreaterThan(20);
    expect(stepRival(RACE_TRACK_LENGTH * RACE_LAPS - 1, 180, 0.05)).toBeGreaterThan(RACE_TRACK_LENGTH * RACE_LAPS);
  });

  it("keeps track positions finite across laps", () => {
    const start = trackPosition(0);
    const afterLoop = trackPosition(RACE_TRACK_LENGTH);
    expect(start.x).toBeCloseTo(afterLoop.x);
    expect(start.z).toBeCloseTo(afterLoop.z);
    expect(Number.isFinite(trackPosition(-10).yaw)).toBe(true);
  });
});