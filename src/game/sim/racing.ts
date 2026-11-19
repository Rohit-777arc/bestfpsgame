export const RACE_TRACK_LENGTH = 354;
export const RACE_LAPS = 3;
export const TRACK_RADIUS_X = 63;
export const TRACK_RADIUS_Z = 50;
export const RAMP_MARKERS = [70, 220] as const;

export type RaceInput = {
  throttle: -1 | 0 | 1;
  steering: -1 | 0 | 1;
  nitro: boolean;
  handbrake: boolean;
};

export type RaceState = {
  speed: number;
  distance: number;
  lateral: number;
  lateralSpeed: number;
  driftMeter: number;
  driftScore: number;
  nitro: number;
  boostTime: number;
  impactTime: number;
  jumpTime: number;
  finished: boolean;
};

export type RaceEvent = "ramp" | "drift" | "wrecked" | "finished";

export const createRaceState = (): RaceState => ({
  speed: 0,
  distance: 0,
  lateral: 0,
  lateralSpeed: 0,
  driftMeter: 0,
  driftScore: 0,
  nitro: 100,
  boostTime: 0,
  impactTime: 0,
  jumpTime: 0,
  finished: false,
});

export function raceLap(distance: number): number {
  return Math.min(RACE_LAPS, Math.floor(Math.max(0, distance) / RACE_TRACK_LENGTH) + 1);
}

function crossedMarker(from: number, to: number, marker: number): boolean {
  if (to <= from) return false;
  const previousLap = Math.floor(from / RACE_TRACK_LENGTH);
  const currentLap = Math.floor(to / RACE_TRACK_LENGTH);
  for (let lap = previousLap; lap <= currentLap; lap++) {
    const at = lap * RACE_TRACK_LENGTH + marker;
    if (at > from && at <= to) return true;
  }
  return false;
}

export function stepRace(state: RaceState, input: RaceInput, delta: number, collision = false): RaceEvent[] {
  const dt = Math.min(Math.max(delta, 0), 0.05);
  if (state.finished || dt === 0) return [];
  const events: RaceEvent[] = [];
  const previousDistance = state.distance;
  state.impactTime = Math.max(0, state.impactTime - dt);
  state.boostTime = Math.max(0, state.boostTime - dt);
  state.jumpTime = Math.max(0, state.jumpTime - dt);

  const boosting = input.nitro && state.nitro > 0;
  const topSpeed = boosting || state.boostTime > 0 ? 265 : 195;
  if (input.throttle > 0) state.speed = Math.min(topSpeed, state.speed + (boosting ? 80 : 58) * dt);
  else if (input.throttle < 0) state.speed = Math.max(0, state.speed - 115 * dt);
  else state.speed = Math.max(0, state.speed - 8 * dt);
  if (boosting) state.nitro = Math.max(0, state.nitro - 33 * dt);

  const grip = input.handbrake ? 0.28 : input.steering !== 0 ? 1.05 : 3.8;
  state.lateralSpeed += input.steering * (10 + state.speed * 0.12) * dt * (input.handbrake ? 1.55 : 1);
  state.lateralSpeed *= Math.exp(-grip * dt);
  state.lateral += state.lateralSpeed * dt;
  if (state.lateral < -9 || state.lateral > 9) {
    state.lateral = Math.max(-9, Math.min(9, state.lateral));
    state.lateralSpeed *= -0.32;
    if (!collision) events.push("wrecked");
    collision = true;
  }

  const sliding = state.speed > 48 && Math.abs(state.lateralSpeed) > 1.1;
  if (sliding) {
    state.driftMeter = Math.min(100, state.driftMeter + dt * (15 + state.speed * 0.11));
    state.driftScore += dt * (Math.abs(state.lateralSpeed) * state.speed * 0.012);
  } else {
    state.driftMeter = Math.max(0, state.driftMeter - 18 * dt);
  }

  const speedFactor = collision ? 0.62 : 1;
  state.distance += (state.speed / 3.6) * dt * speedFactor;
  if (collision) {
    state.impactTime = 0.85;
    state.speed *= 0.6;
    state.lateralSpeed *= -0.45;
    events.push("wrecked");
  }

  if (Math.abs(state.lateral) < 6.4 && RAMP_MARKERS.some((marker) => crossedMarker(previousDistance, state.distance, marker))) {
    state.nitro = Math.min(100, state.nitro + 42);
    state.boostTime = 2.2;
    state.jumpTime = 0.9;
    events.push("ramp");
  }

  if (state.driftMeter >= 100) {
    state.driftMeter = 0;
    state.nitro = Math.min(100, state.nitro + 18);
    events.push("drift");
  }

  if (state.distance >= RACE_TRACK_LENGTH * RACE_LAPS) {
    state.distance = RACE_TRACK_LENGTH * RACE_LAPS;
    state.finished = true;
    events.push("finished");
  }
  return events;
}

export function trackPosition(distance: number, lateral = 0): { x: number; z: number; yaw: number } {
  const angle = (Math.max(0, distance) / RACE_TRACK_LENGTH) * Math.PI * 2;
  const radiusX = TRACK_RADIUS_X + lateral;
  const radiusZ = TRACK_RADIUS_Z + lateral;
  const x = radiusX * Math.sin(angle);
  const z = radiusZ * Math.cos(angle);
  const tangentX = radiusX * Math.cos(angle);
  const tangentZ = -radiusZ * Math.sin(angle);
  return { x, z, yaw: Math.atan2(-tangentX, -tangentZ) };
}

export function stepRival(distance: number, speedKph: number, delta: number): number {
  return distance + (Math.max(0, speedKph) / 3.6) * Math.min(Math.max(delta, 0), 0.05);
}