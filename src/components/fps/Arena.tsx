// The one game engine every mode shares: Dungeon waves, Training drills,
// Co-op waves and 1v1 Duels. Per-frame state lives in refs; React state only
// holds what the HUD shows and changes on events, never per frame.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { MAPS, type MapId } from "@/game/sim/maps";
import { ARENA, CRATES } from "@/game/sim/arena";
import { WEAPONS, shotInterval, type WeaponId } from "@/game/sim/weapons";
import { enemyBehaviorForWave, scaledTier, spawnPlan, type Difficulty } from "@/game/sim/waves";
import { Scene } from "./Scene";
import { EnemyMesh, RemoteMesh, type EnemyRuntime, type RemoteRuntime } from "./Actors";
import { TouchControls, type TouchInput } from "./TouchControls";
import { Button } from "@/components/ui/button";
import {
  isCoordinator,
  playerId,
  sendEvent,
  sendState,
  type NetBus,
  type NetEvent,
  type RosterEntry,
} from "@/game/net";

export type ArenaMode = "dungeon" | "train" | "coop" | "duel";

export interface NetLink {
  channelRef: MutableRefObject<RealtimeChannel | null>;
  bus: MutableRefObject<NetBus>;
  roster: RosterEntry[];
}

export interface ArenaProps {
  mode: ArenaMode;
  map: MapId;
  difficulty: Difficulty;
  trainLevel?: number; // 1..5
  weapon: WeaponId;
  playerName: string;
  credits: number;
  net?: NetLink;
  onWaveCleared?: (wave: number) => Promise<number> | number; // returns credits awarded
  onExit: () => void;
}

const EYE = 1.7;
const SPEED = 7.5;
const GRAVITY = 24;
const JUMP_V = 9;
const SENS = 0.0022;
const SCOPE_FOV = 20;
const MAX_HP = 100;
const TRAIN_TIME = 60;
const INTERMISSION = 4;
const DUEL_TARGET = 5;
const NET_TICK = 1 / 8;

type Hud = {
  hp: number;
  ammo: number;
  mag: number;
  reloading: boolean;
  wave: number;
  enemiesLeft: number;
  kills: number;
  score: number;
  shots: number;
  hits: number;
  time: number;
  banner: string | null;
  sub: string | null;
  over: null | { title: string; lines: string[] };
  feed: { id: number; text: string }[];
  locked: boolean;
  aiming: boolean;
  hitMark: number;
  hurt: number;
  duel: Record<string, number>;
  earned: number;
};

const initialHud = (mag: number): Hud => ({
  hp: MAX_HP,
  ammo: mag,
  mag,
  reloading: false,
  wave: 0,
  enemiesLeft: 0,
  kills: 0,
  score: 0,
  shots: 0,
  hits: 0,
  time: TRAIN_TIME,
  banner: null,
  sub: null,
  over: null,
  feed: [],
  locked: false,
  aiming: false,
  hitMark: 0,
  hurt: 0,
  duel: {},
  earned: 0,
});

type Api = {
  patch: (p: Partial<Hud> | ((h: Hud) => Partial<Hud>)) => void;
  feed: (text: string) => void;
};

const bulletGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6).rotateX(Math.PI / 2);
const bulletMat = new THREE.MeshBasicMaterial({ color: "#ffe08a" });
const sparkGeo = new THREE.SphereGeometry(0.12, 8, 8);

function blocked(x: number, z: number, feet: number, pad = 0.4) {
  return CRATES.some((c) => feet < c.s - 0.1 && Math.abs(x - c.x) < c.s / 2 + pad && Math.abs(z - c.z) < c.s / 2 + pad);
}

function World(props: ArenaProps & { api: Api; startRef: MutableRefObject<() => void>; resumeRef: MutableRefObject<() => void>; touchInput: MutableRefObject<TouchInput>; reloadRef: MutableRefObject<() => void>; paused: boolean }) {
  const { mode, difficulty, net, api } = props;
  const weapon = WEAPONS[props.weapon];
  const { camera, scene, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  const keys = useRef<Record<string, boolean>>({});
  const look = useRef({ yaw: 0, pitch: 0 });
  const touchMode = useRef(false);
  const touch = props.touchInput;
  const vy = useRef(0);
  const firing = useRef(false);
  const aiming = useRef(false);
  const cooldown = useRef(0);
  const ammo = useRef(weapon.mag);
  const reload = useRef(0);
  const recoil = useRef(0);
  const hp = useRef(MAX_HP);
  const dead = useRef(false);
  const respawnAt = useRef(0);
  const gun = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const fx = useRef<THREE.Group>(null);
  const tracers = useRef<{ m: THREE.Mesh; dir: THREE.Vector3; left: number }[]>([]);
  const sparks = useRef<{ m: THREE.Mesh; life: number }[]>([]);
  const ray = useMemo(() => new THREE.Raycaster(), []);

  // enemies
  const enemies = useRef<EnemyRuntime[]>([]);
  const [enemyKeys, setEnemyKeys] = useState<string[]>([]);
  const wave = useRef(0);
  const waveSeed = useRef(0);
  const nextWaveAt = useRef(-1);
  const clearedWave = useRef(0);
  const kills = useRef(0);
  const shots = useRef(0);
  const hits = useRef(0);
  const clock = useRef(0);
  const timeLeft = useRef(TRAIN_TIME);
  const over = useRef(false);
  const nextEnemyId = useRef(1000);

  // remotes
  const remotes = useRef(new Map<string, RemoteRuntime>());
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const netAcc = useRef(0);
  const lastSent = useRef({ x: 0, y: 0, z: 0, ry: 0, at: -10 });
  const duelScore = useRef<Record<string, number>>({});

  const online = mode === "coop" || mode === "duel";
  const roster = net?.roster ?? [];
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const nameOf = (id: string) => (id === playerId() ? props.playerName : rosterRef.current.find((r) => r.id === id)?.name ?? "Player");

  // ---- spawning ----
  const spawnPoint = useCallback((): [number, number] => {
    if (mode === "duel") {
      const ids = rosterRef.current.map((r) => r.id).sort();
      const idx = Math.max(0, ids.indexOf(playerId()));
      const corners: [number, number][] = [[-30, -30], [30, 30], [30, -30], [-30, 30]];
      const c = corners[(idx + Math.floor(Math.random() * 2) * 2) % 4];
      return c;
    }
    if (online) {
      const ids = rosterRef.current.map((r) => r.id).sort();
      const idx = Math.max(0, ids.indexOf(playerId()));
      return [idx * 2.5 - 2, 2];
    }
    return [0, 0];
  }, [mode, online]);

  const respawn = useCallback(() => {
    const [x, z] = spawnPoint();
    camera.position.set(x, EYE, z);
    vy.current = 0;
    hp.current = MAX_HP;
    dead.current = false;
    ammo.current = weapon.mag;
    reload.current = 0;
    api.patch({ hp: MAX_HP, ammo: weapon.mag, reloading: false });
  }, [api, camera, spawnPoint, weapon.mag]);

  const makeEnemy = useCallback(
    (id: number, tier: EnemyRuntime["tier"], x: number, z: number): EnemyRuntime => {
      const s = scaledTier(difficulty, tier);
      const trainSpeed = 0.8 + (props.trainLevel ?? 1) * 0.9;
      const behavior = enemyBehaviorForWave(mode === "coop" || mode === "dungeon" ? wave.current : 1);
      return {
        id,
        tier,
        hp: mode === "train" ? 1 : s.hp,
        max: mode === "train" ? 1 : s.hp,
        x,
        z,
        ry: 0,
        speed: mode === "train" ? trainSpeed : s.speed,
        damage: s.damage,
        reach: s.reach,
        cd: 1,
        attackCd: 1 + Math.random() * 1.2,
        aimError: behavior.aimError,
        attackInterval: behavior.attackInterval,
        strafe: behavior.strafe,
        alive: true,
        fall: 0,
        phase: Math.random() * 6,
        moving: true,
        goalX: (Math.random() - 0.5) * ARENA * 1.6,
        goalZ: (Math.random() - 0.5) * ARENA * 1.6,
        flash: 0,
      };
    },
    [difficulty, mode, props.trainLevel],
  );

  const syncEnemyKeys = () => setEnemyKeys(enemies.current.map((e) => `${wave.current}:${e.id}`));

  const startWave = useCallback(
    (n: number, seed: number) => {
      wave.current = n;
      waveSeed.current = seed;
      nextWaveAt.current = -1;
      enemies.current = spawnPlan(difficulty, n, seed).map((p) => makeEnemy(p.id, p.tier, p.x, p.z));
      syncEnemyKeys();
      api.patch({ wave: n, enemiesLeft: enemies.current.length, banner: `WAVE ${n}`, sub: `${enemies.current.length} enemies incoming` });
      setTimeout(() => api.patch({ banner: null, sub: null }), 2200);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, difficulty, makeEnemy],
  );

  const startTraining = useCallback(() => {
    const n = 3 + (props.trainLevel ?? 1);
    enemies.current = Array.from({ length: n }, (_, i) => {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 20;
      return makeEnemy(i, "grunt", Math.cos(a) * r, Math.sin(a) * r);
    });
    syncEnemyKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeEnemy, props.trainLevel]);

  // ---- begin / restart ----
  const begin = useCallback(() => {
    over.current = false;
    kills.current = 0;
    shots.current = 0;
    hits.current = 0;
    clearedWave.current = 0;
    timeLeft.current = TRAIN_TIME;
    duelScore.current = {};
    respawn();
    api.patch({ ...initialHud(weapon.mag), locked: touchMode.current });
    if (mode === "train") startTraining();
    else if (mode === "dungeon") startWave(1, Math.floor(Math.random() * 1e9));
    else if (mode === "coop") {
      enemies.current = [];
      syncEnemyKeys();
      if (isCoordinator(rosterRef.current)) {
        const seed = Math.floor(Math.random() * 1e9);
        sendEvent(net?.channelRef.current ?? null, { type: "wave", from: playerId(), wave: 1, seed });
        startWave(1, seed);
      } else {
        api.patch({ banner: "WAITING", sub: "for the host to start the wave" });
      }
    } else if (mode === "duel") {
      enemies.current = [];
      syncEnemyKeys();
      api.patch({ banner: "DUEL", sub: `First to ${DUEL_TARGET} wins`, duel: {} });
      setTimeout(() => api.patch({ banner: null, sub: null }), 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, mode, respawn, startTraining, startWave, weapon.mag]);

  props.startRef.current = begin;

  props.resumeRef.current = () => {
    if (touchMode.current) {
      api.patch({ locked: true });
      return;
    }
    const lockRequest = gl.domElement.requestPointerLock?.();
    if (!lockRequest) api.patch({ locked: true });
  };

  useEffect(() => {
    touchMode.current = window.matchMedia("(pointer: coarse)").matches;
    if (touchMode.current) api.patch({ locked: true });
  }, []);

  useEffect(() => {
    camera.rotation.order = "YXZ";
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- network events ----
  useEffect(() => {
    if (!net) return;
    net.bus.current.onState = (s) => {
      let r = remotes.current.get(s.id);
      if (!r) {
        r = { id: s.id, name: s.name, x: s.x, y: s.y, z: s.z, ry: s.ry, tx: s.x, ty: s.y, tz: s.z, tr: s.ry, hp: s.hp, seen: false };
        remotes.current.set(s.id, r);
      }
      r.tx = s.x;
      r.ty = s.y;
      r.tz = s.z;
      r.tr = s.ry;
      r.hp = s.hp;
      r.name = s.name;
      r.seen = true;
    };
    net.bus.current.onEvent = (e: NetEvent) => {
      if (e.type === "wave" && mode === "coop") {
        if (e.wave !== wave.current) startWave(e.wave, e.seed);
      } else if (e.type === "kill" && mode === "coop") {
        if (e.wave !== wave.current) return;
        const en = enemies.current.find((x) => x.id === e.enemyId);
        if (en && en.alive) {
          en.alive = false;
          en.hp = 0;
          api.feed(`${e.name} ▸ ${en.tier.toUpperCase()}`);
          api.patch({ enemiesLeft: enemies.current.filter((x) => x.alive).length });
        }
      } else if (e.type === "duelhit" && mode === "duel") {
        if (e.to !== playerId() || dead.current || over.current) return;
        hp.current = Math.max(0, hp.current - e.dmg);
        api.patch({ hp: hp.current, hurt: Date.now() });
        if (hp.current <= 0) {
          dead.current = true;
          respawnAt.current = clock.current + 3;
          duelScore.current = { ...duelScore.current, [e.from]: (duelScore.current[e.from] ?? 0) + 1 };
          const killerName = nameOf(e.from);
          sendEvent(net.channelRef.current, { type: "frag", from: playerId(), killer: e.from, killerName, victimName: props.playerName });
          api.feed(`${killerName} ▸ ${props.playerName}`);
          api.patch({ duel: duelScore.current, banner: "ELIMINATED", sub: `by ${killerName}` });
          checkDuelEnd();
        }
      } else if (e.type === "frag" && mode === "duel") {
        duelScore.current = { ...duelScore.current, [e.killer]: (duelScore.current[e.killer] ?? 0) + 1 };
        api.feed(`${e.killerName} ▸ ${e.victimName}`);
        api.patch({ duel: duelScore.current });
        if (e.killer === playerId()) {
          api.patch({ banner: "ELIMINATION", sub: `+1 vs ${e.victimName}` });
          setTimeout(() => api.patch({ banner: null, sub: null }), 1500);
        }
        checkDuelEnd();
      } else if (e.type === "restart") {
        begin();
      }
    };
    return () => {
      net.bus.current.onState = undefined;
      net.bus.current.onEvent = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, mode, startWave, begin]);

  function checkDuelEnd() {
    for (const [id, s] of Object.entries(duelScore.current)) {
      if (s >= DUEL_TARGET) {
        over.current = true;
        const won = id === playerId();
        document.exitPointerLock?.();
        api.patch({
          banner: null,
          sub: null,
          over: { title: won ? "VICTORY" : "DEFEAT", lines: [`${nameOf(id)} wins the duel ${s}–${otherScore(id)}`] },
        });
      }
    }
  }
  function otherScore(id: string) {
    return Object.entries(duelScore.current).filter(([k]) => k !== id).reduce((a, [, v]) => Math.max(a, v), 0);
  }

  // remote roster → avatars
  useEffect(() => {
    if (!online) return;
    const ids = roster.map((r) => r.id).filter((id) => id !== playerId());
    for (const id of [...remotes.current.keys()]) if (!ids.includes(id)) remotes.current.delete(id);
    for (const id of ids) {
      if (!remotes.current.has(id)) {
        const name = roster.find((r) => r.id === id)?.name ?? "Player";
        remotes.current.set(id, { id, name, x: 0, y: EYE, z: 0, ry: 0, tx: 0, ty: EYE, tz: 0, tr: 0, hp: MAX_HP, seen: false });
      }
    }
    setRemoteIds(ids);
  }, [roster, online]);

  // ---- input ----
  useEffect(() => {
    const el = gl.domElement;
    const kd = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "Space") e.preventDefault();
      if (e.code === "KeyR") startReload();
    };
    const ku = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const mm = (e: MouseEvent) => {
      if (touchMode.current) return;
      if (document.pointerLockElement !== el) return;
      const s = SENS * (aiming.current ? 0.35 : 1);
      look.current.yaw -= e.movementX * s;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * s, -1.5, 1.5);
    };
    const md = (e: MouseEvent) => {
      if (over.current) return;
      if (touchMode.current) return;
      if (document.pointerLockElement !== el) {
        el.requestPointerLock?.();
        return;
      }
      if (e.button === 0) firing.current = true;
      if (e.button === 2 && weapon.scope) {
        aiming.current = true;
        api.patch({ aiming: true });
      }
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) firing.current = false;
      if (e.button === 2 && aiming.current) {
        aiming.current = false;
        api.patch({ aiming: false });
      }
    };
    const plc = () => {
      const locked = document.pointerLockElement === el;
      if (!locked && !touchMode.current) {
        firing.current = false;
        if (aiming.current) {
          aiming.current = false;
          api.patch({ aiming: false });
        }
        keys.current = {};
      }
      if (!touchMode.current) api.patch({ locked });
    };
    const noCtx = (e: Event) => e.preventDefault();
    addEventListener("keydown", kd);
    addEventListener("keyup", ku);
    addEventListener("mousemove", mm);
    el.addEventListener("mousedown", md);
    addEventListener("mouseup", mu);
    el.addEventListener("contextmenu", noCtx);
    document.addEventListener("pointerlockchange", plc);
    return () => {
      removeEventListener("keydown", kd);
      removeEventListener("keyup", ku);
      removeEventListener("mousemove", mm);
      el.removeEventListener("mousedown", md);
      removeEventListener("mouseup", mu);
      el.removeEventListener("contextmenu", noCtx);
      document.removeEventListener("pointerlockchange", plc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, weapon]);

  function startReload() {
    if (reload.current > 0 || ammo.current === weapon.mag || dead.current) return;
    reload.current = weapon.reloadTime;
    api.patch({ reloading: true });
  }
  props.reloadRef.current = startReload;

  function addSpark(at: THREE.Vector3, hot: boolean) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: hot ? "#ff5a36" : "#fff1c4", transparent: true }));
    m.position.copy(at);
    fx.current?.add(m);
    sparks.current.push({ m, life: 0.3 });
  }

  function killEnemy(en: EnemyRuntime, mine: boolean) {
    en.alive = false;
    en.hp = 0;
    if (mine) {
      kills.current++;
      api.feed(`${props.playerName} ▸ ${mode === "train" ? "DUMMY" : en.tier.toUpperCase()}`);
      if (mode === "coop") {
        sendEvent(net?.channelRef.current ?? null, {
          type: "kill",
          from: playerId(),
          name: props.playerName,
          enemyId: en.id,
          wave: wave.current,
          tier: en.tier,
        });
      }
    }
    if (mode === "train") {
      api.patch({ score: kills.current, kills: kills.current });
      setTimeout(() => {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 25;
        const fresh = makeEnemy(nextEnemyId.current++, "grunt", Math.cos(a) * r, Math.sin(a) * r);
        enemies.current = enemies.current.filter((x) => x !== en).concat(fresh);
        syncEnemyKeys();
      }, 900);
    } else {
      api.patch({ kills: kills.current, enemiesLeft: enemies.current.filter((x) => x.alive).length });
    }
  }

  function fire() {
    shots.current++;
    cooldown.current = shotInterval(weapon);
    ammo.current--;
    recoil.current = 1;
    camera.updateMatrixWorld();
    const muzzle = new THREE.Vector3(0.22, -0.18, -0.7).applyMatrix4(camera.matrixWorld);
    const spread = aiming.current ? 0.0008 : weapon.spread;
    let landed = false;
    let killedRemote: string | null = null;
    let remoteDmg = 0;
    for (let p = 0; p < weapon.pellets; p++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2 * spread,
        (Math.random() - 0.5) * 2 * spread,
        -1,
      )
        .normalize()
        .applyQuaternion(camera.quaternion);
      ray.set(camera.position, dir);
      ray.far = 160;
      const hit = ray
        .intersectObjects(scene.children, true)
        .find((h) => {
          const u = h.object.userData;
          if (u.enemyId !== undefined) return enemies.current.some((e) => e.id === u.enemyId && e.alive);
          if (u.remoteId !== undefined) return mode === "duel";
          return !!u.solid;
        });
      const end = hit ? hit.point.clone() : camera.position.clone().addScaledVector(dir, 150);
      if (p < 3) {
        const m = new THREE.Mesh(bulletGeo, bulletMat);
        m.position.copy(muzzle);
        m.lookAt(end);
        const d = end.clone().sub(muzzle);
        fx.current?.add(m);
        tracers.current.push({ m, dir: d.clone().normalize(), left: d.length() });
      }
      if (!hit) continue;
      const u = hit.object.userData;
      const headshot = hit.point.y > 1.75;
      const dmg = Math.round(weapon.damage * (headshot ? 1.5 : 1));
      if (u.enemyId !== undefined) {
        const en = enemies.current.find((e) => e.id === u.enemyId);
        if (en && en.alive) {
          landed = true;
          en.hp -= dmg;
          en.flash = 0.08;
          addSpark(end, true);
          if (en.hp <= 0) killEnemy(en, true);
        }
      } else if (u.remoteId !== undefined && mode === "duel") {
        landed = true;
        killedRemote = String(u.remoteId);
        remoteDmg += dmg;
        addSpark(end, true);
      } else {
        addSpark(end, false);
      }
    }
    if (killedRemote && remoteDmg > 0) {
      sendEvent(net?.channelRef.current ?? null, { type: "duelhit", from: playerId(), to: killedRemote, dmg: remoteDmg });
    }
    if (landed) hits.current++;
    api.patch({ ammo: ammo.current, shots: shots.current, hits: hits.current, ...(landed ? { hitMark: Date.now() } : {}) });
    if (!weapon.auto) {
      firing.current = false;
      touch.current.firing = false;
    }
    if (ammo.current <= 0) startReload();
  }

  async function waveDone(n: number) {
    if (clearedWave.current >= n) return;
    clearedWave.current = n;
    let awarded = 0;
    try {
      awarded = (await props.onWaveCleared?.(n)) ?? 0;
    } catch {
      awarded = 0;
    }
    api.patch((h) => ({ banner: `WAVE ${n} CLEARED`, sub: awarded ? `+${awarded} CREDITS` : "Next wave incoming", earned: h.earned + awarded }));
    setTimeout(() => api.patch({ banner: null, sub: null }), 2500);
  }

  // ---- the one stepper ----
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    clock.current += dt;
    const k = keys.current;
    const live = !props.paused && !over.current;

    if (touchMode.current) {
      look.current.yaw -= touch.current.lookDX * SENS * 1.45;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - touch.current.lookDY * SENS * 1.45, -1.5, 1.5);
      touch.current.lookDX = 0;
      touch.current.lookDY = 0;
      aiming.current = touch.current.aiming;
      firing.current = touch.current.firing;
    }

    camera.rotation.set(look.current.pitch, look.current.yaw, 0, "YXZ");
    const targetFov = aiming.current ? SCOPE_FOV : 75;
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-14 * dt));
      cam.updateProjectionMatrix();
    }

    // death / respawn
    if (dead.current && online && clock.current >= respawnAt.current && !over.current) {
      respawn();
      api.patch({ banner: null, sub: null });
    }

    // movement
    const fwd = new THREE.Vector3(-Math.sin(look.current.yaw), 0, -Math.cos(look.current.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (live && !dead.current) {
      if (k.KeyW) move.add(fwd);
      if (k.KeyS) move.sub(fwd);
      if (k.KeyD) move.add(right);
      if (k.KeyA) move.sub(right);
      if (touchMode.current) {
        move.addScaledVector(fwd, touch.current.moveY);
        move.addScaledVector(right, touch.current.moveX);
      }
    }
    const feetY = camera.position.y - EYE;
    const under = CRATES.find((c) => Math.abs(camera.position.x - c.x) < c.s / 2 + 0.3 && Math.abs(camera.position.z - c.z) < c.s / 2 + 0.3);
    const floor = under && feetY >= under.s - 0.5 ? under.s : 0;
    const grounded = feetY <= floor + 0.001;
    if (live && !dead.current && (k.Space || (touchMode.current && touch.current.jump)) && grounded) vy.current = JUMP_V;
    vy.current -= GRAVITY * dt;
    camera.position.y += vy.current * dt;
    if (camera.position.y - EYE < floor) {
      camera.position.y = EYE + floor;
      vy.current = 0;
    }
    if (move.lengthSq()) {
      move.normalize().multiplyScalar(SPEED * dt * (k.ShiftLeft ? 1.5 : 1) * (aiming.current ? 0.5 : 1));
      const feet = camera.position.y - EYE;
      const nx = camera.position.x + move.x;
      const nz = camera.position.z + move.z;
      if (!blocked(nx, camera.position.z, feet)) camera.position.x = nx;
      if (!blocked(camera.position.x, nz, feet)) camera.position.z = nz;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA + 0.5, ARENA - 0.5);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA + 0.5, ARENA - 0.5);
    }

    // weapon
    cooldown.current -= dt;
    if (reload.current > 0) {
      reload.current -= dt;
      if (reload.current <= 0) {
        reload.current = 0;
        ammo.current = weapon.mag;
        api.patch({ ammo: weapon.mag, reloading: false });
      }
    }
    if (live && !dead.current && firing.current && cooldown.current <= 0 && ammo.current > 0 && reload.current <= 0) fire();

    // training timer
    if (mode === "train" && live) {
      const before = Math.ceil(timeLeft.current);
      timeLeft.current -= dt;
      const after = Math.max(0, Math.ceil(timeLeft.current));
      if (after !== before) api.patch({ time: after });
      if (timeLeft.current <= 0) {
        over.current = true;
        document.exitPointerLock?.();
        const acc = shots.current ? Math.round((hits.current / shots.current) * 100) : 0;
        api.patch({ over: { title: "DRILL COMPLETE", lines: [`${kills.current} dummies down`, `${acc}% accuracy`, `${shots.current} shots fired`] } });
      }
    }

    // enemies AI
    const me = camera.position;
    const targets: { x: number; z: number; local: boolean }[] = [];
    if (!dead.current) targets.push({ x: me.x, z: me.z, local: true });
    for (const r of remotes.current.values()) if (r.seen && r.hp > 0) targets.push({ x: r.x, z: r.z, local: false });

    let aliveCount = 0;
    for (const e of enemies.current) {
      if (e.flash > 0) e.flash -= dt;
      if (!e.alive) {
        e.fall = Math.min(e.fall + dt * 3, 2);
        continue;
      }
      aliveCount++;
      if (!live) {
        e.moving = false;
        continue;
      }
      let gx = e.goalX;
      let gz = e.goalZ;
      let chasing: { x: number; z: number; local: boolean } | null = null;
      if (mode !== "train" && targets.length) {
        chasing = targets.reduce((a, b) => (Math.hypot(b.x - e.x, b.z - e.z) < Math.hypot(a.x - e.x, a.z - e.z) ? b : a));
        gx = chasing.x;
        gz = chasing.z;
      }
      const dx = gx - e.x;
      const dz = gz - e.z;
      const dist = Math.hypot(dx, dz);
      e.cd -= dt;
      e.attackCd -= dt;
      if ((mode === "dungeon" || mode === "coop") && !dead.current) {
        const shotDx = me.x - e.x;
        const shotDz = me.z - e.z;
        const shotDistance = Math.hypot(shotDx, shotDz);
        if (shotDistance > 2.5 && shotDistance < 28 && e.attackCd <= 0) {
          e.attackCd = e.attackInterval;
          e.ry = Math.atan2(shotDx, shotDz);
          const origin = new THREE.Vector3(e.x, 1.4, e.z);
          const target = new THREE.Vector3(me.x, me.y - 0.12, me.z);
          const distance = origin.distanceTo(target);
          const targetDelta = target.clone().sub(origin);
          const direction = targetDelta.clone().normalize();
          const error = e.aimError;
          direction.x += (Math.random() - 0.5) * error;
          direction.y += (Math.random() - 0.5) * error * 0.65;
          direction.z += (Math.random() - 0.5) * error;
          direction.normalize();
          ray.set(origin, direction);
          ray.far = distance;
          const cover = ray.intersectObjects(scene.children, true).some((hit) => hit.object.userData.solid && hit.distance < distance - 0.25);
          const along = targetDelta.dot(direction);
          const closest = origin.clone().addScaledVector(direction, along);
          const hitPlayer = !cover && along > 0 && along <= distance + 0.4 && closest.distanceTo(target) < 0.75;
          const tracer = new THREE.Mesh(bulletGeo, bulletMat);
          tracer.position.copy(origin);
          const endpoint = origin.clone().addScaledVector(direction, Math.min(distance, 32));
          tracer.lookAt(endpoint);
          const travel = endpoint.distanceTo(origin);
          fx.current?.add(tracer);
          tracers.current.push({ m: tracer, dir: direction.clone(), left: travel });
          if (hitPlayer && !dead.current) {
            hp.current = Math.max(0, hp.current - e.damage);
            api.patch({ hp: hp.current, hurt: Date.now() });
            if (hp.current <= 0) {
              dead.current = true;
              if (mode === "dungeon") {
                over.current = true;
                document.exitPointerLock?.();
                api.patch((h) => ({
                  over: { title: "YOU DIED", lines: [`Reached wave ${wave.current}`, `${kills.current} enemies down`, `+${h.earned} credits this run`] },
                }));
              } else {
                respawnAt.current = clock.current + 5;
                api.patch({ banner: "DOWNED", sub: "Back in 5s" });
              }
            }
          }
        }
      }
      if (chasing && dist < e.reach) {
        e.moving = false;
        e.ry = Math.atan2(dx, dz);
        if (e.cd <= 0 && chasing.local && !dead.current && Math.abs(me.y - EYE) < 2.2) {
          e.cd = 1.1;
          hp.current = Math.max(0, hp.current - Math.max(2, Math.round(e.damage * 0.55)));
          api.patch({ hp: hp.current, hurt: Date.now() });
          if (hp.current <= 0) {
            dead.current = true;
            if (mode === "dungeon") {
              over.current = true;
              document.exitPointerLock?.();
              api.patch((h) => ({
                over: {
                  title: "YOU DIED",
                  lines: [`Reached wave ${wave.current}`, `${kills.current} enemies down`, `+${h.earned} credits this run`],
                },
              }));
            } else {
              respawnAt.current = clock.current + 5;
              api.patch({ banner: "DOWNED", sub: "Back in 5s" });
            }
          }
        }
        continue;
      }
      if (!chasing && dist < 1) {
        e.goalX = (Math.random() - 0.5) * ARENA * 1.6;
        e.goalZ = (Math.random() - 0.5) * ARENA * 1.6;
        continue;
      }
      let moveX = dx;
      let moveZ = dz;
      if (chasing && (mode === "dungeon" || mode === "coop") && dist > 0.01) {
        const preferred = e.tier === "brute" ? 8 : e.tier === "runner" ? 12 : 10;
        const radial = THREE.MathUtils.clamp((dist - preferred) / Math.max(dist, 1), -0.7, 1);
        const side = Math.sin(clock.current * 0.9 + e.phase) * e.strafe;
        moveX = dx * radial - (dz / dist) * side;
        moveZ = dz * radial + (dx / dist) * side;
      }
      const moveLength = Math.max(0.001, Math.hypot(moveX, moveZ));
      const step = e.speed * dt;
      const nx = e.x + (moveX / moveLength) * step;
      const nz = e.z + (moveZ / moveLength) * step;
      const hitX = blocked(nx, e.z, 0, 0.45);
      const hitZ = blocked(e.x, nz, 0, 0.45);
      if (!hitX) e.x = nx;
      if (!hitZ) e.z = nz;
      if (hitX && hitZ) {
        // sidestep around the crate
        const side = Math.sin(e.phase) > 0 ? 1 : -1;
        e.x += (-dz / dist) * step * side;
        e.z += (dx / dist) * step * side;
        if (!chasing) {
          e.goalX = (Math.random() - 0.5) * ARENA * 1.6;
          e.goalZ = (Math.random() - 0.5) * ARENA * 1.6;
        }
      }
      e.ry = THREE.MathUtils.lerp(e.ry, Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
      e.moving = true;
    }

    // wave progression
    if ((mode === "dungeon" || mode === "coop") && !over.current && wave.current > 0 && aliveCount === 0 && enemies.current.length) {
      if (nextWaveAt.current < 0) {
        nextWaveAt.current = clock.current + INTERMISSION;
        void waveDone(wave.current);
      } else if (clock.current >= nextWaveAt.current) {
        const coordinator = mode === "dungeon" || isCoordinator(rosterRef.current);
        if (coordinator) {
          const seed = Math.floor(Math.random() * 1e9);
          const n = wave.current + 1;
          if (mode === "coop") sendEvent(net?.channelRef.current ?? null, { type: "wave", from: playerId(), wave: n, seed });
          startWave(n, seed);
        } else {
          nextWaveAt.current = clock.current + 2; // wait for the coordinator's wave event
        }
      }
    }

    // gun pose
    recoil.current *= Math.exp(-12 * dt);
    const bob = move.lengthSq() && grounded ? Math.sin(state.clock.elapsedTime * 12) * 0.015 : 0;
    if (gun.current) {
      gun.current.visible = !aiming.current && !dead.current;
      gun.current.position.copy(camera.position);
      gun.current.quaternion.copy(camera.quaternion);
      gun.current.translateX(0.25);
      gun.current.translateY(-0.22 + bob - (reload.current > 0 ? 0.12 : 0));
      gun.current.translateZ(-0.5 + recoil.current * 0.08);
      gun.current.rotateX(recoil.current * 0.18 + (reload.current > 0 ? -0.6 : 0));
    }
    if (flash.current) flash.current.intensity = recoil.current > 0.7 ? 8 : 0;

    // fx
    tracers.current = tracers.current.filter((b) => {
      const step = Math.min(160 * dt, b.left);
      b.m.position.addScaledVector(b.dir, step);
      b.left -= step;
      if (b.left <= 0) {
        fx.current?.remove(b.m);
        return false;
      }
      return true;
    });
    sparks.current = sparks.current.filter((s) => {
      s.life -= dt;
      s.m.scale.setScalar(1 + (0.3 - s.life) * 8);
      (s.m.material as THREE.MeshBasicMaterial).opacity = Math.max(s.life / 0.3, 0);
      if (s.life <= 0) {
        fx.current?.remove(s.m);
        (s.m.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });

    // network send
    if (online && net) {
      netAcc.current += dt;
      if (netAcc.current >= NET_TICK && !document.hidden) {
        netAcc.current = 0;
        const x = Math.round(me.x * 100) / 100;
        const y = Math.round(me.y * 100) / 100;
        const z = Math.round(me.z * 100) / 100;
        const ry = Math.round(look.current.yaw * 100) / 100;
        const l = lastSent.current;
        const moved = Math.abs(x - l.x) + Math.abs(y - l.y) + Math.abs(z - l.z) + Math.abs(ry - l.ry) > 0.01;
        if (moved || clock.current - l.at > 1) {
          lastSent.current = { x, y, z, ry, at: clock.current };
          sendState(net.channelRef.current, {
            id: playerId(),
            name: props.playerName,
            x,
            y,
            z,
            ry,
            hp: dead.current ? 0 : hp.current,
            weapon: weapon.id,
          });
        }
      }
    }
  });

  const gunLen = weapon.id === "longbow-sniper" ? 0.75 : weapon.id === "marksman-rifle" ? 0.62 : weapon.id === "riot-shotgun" ? 0.55 : weapon.id === "vector-smg" ? 0.4 : 0.28;
  const gunCol = weapon.id === "riot-shotgun" ? "#5a3a22" : weapon.id === "vector-smg" ? "#2a2d33" : weapon.id === "longbow-sniper" ? "#3b4a33" : "#3a3d40";

  return (
    <>
      <Scene map={MAPS[props.map]} />
      {enemyKeys.map((key) => {
        const id = Number(key.split(":")[1]);
        const e = enemies.current.find((x) => x.id === id);
        return e ? <EnemyMesh key={key} e={e} /> : null;
      })}
      {remoteIds.map((id) => {
        const r = remotes.current.get(id);
        return r ? <RemoteMesh key={id} r={r} foe={mode === "duel"} /> : null;
      })}
      <group ref={fx} />
      <group ref={gun}>
        <mesh>
          <boxGeometry args={[0.07, 0.1, gunLen]} />
          <meshStandardMaterial color={gunCol} metalness={0.7} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.01, -gunLen / 2 - 0.08]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.1, 0.08]} rotation-x={0.3}>
          <boxGeometry args={[0.06, 0.16, 0.08]} />
          <meshStandardMaterial color="#4a3020" />
        </mesh>
        {weapon.scope && (
          <mesh position={[0, 0.09, -0.05]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.03, 0.03, 0.28, 12]} />
            <meshStandardMaterial color="#111" metalness={0.8} roughness={0.3} />
          </mesh>
        )}
        {weapon.id === "vector-smg" && (
          <mesh position={[0, -0.12, -0.05]}>
            <boxGeometry args={[0.04, 0.16, 0.06]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        )}
        <pointLight ref={flash} position={[0, 0, -gunLen / 2 - 0.2]} color="#ffb347" distance={6} intensity={0} />
      </group>
    </>
  );
}

export function Arena(props: ArenaProps) {
  const weapon = WEAPONS[props.weapon];
  const [hud, setHud] = useState<Hud>(() => initialHud(weapon.mag));
  const feedId = useRef(0);
  const startRef = useRef<() => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});
  const reloadRef = useRef<() => void>(() => {});
  const touchInput = useRef<TouchInput>({ moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, firing: false, jump: false, aiming: false });
  const api = useMemo<Api>(
    () => ({
      patch: (p) => setHud((h) => ({ ...h, ...(typeof p === "function" ? p(h) : p) })),
      feed: (text) => {
        const id = ++feedId.current;
        setHud((h) => ({ ...h, feed: [...h.feed.slice(-4), { id, text }] }));
        setTimeout(() => setHud((h) => ({ ...h, feed: h.feed.filter((f) => f.id !== id) })), 5000);
      },
    }),
    [],
  );

  const paused = !hud.locked && !hud.over;
  const map = MAPS[props.map];
  const acc = hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 0;
  const me = playerId();
  const hurtRecent = Date.now() - hud.hurt < 350;
  const hitRecent = Date.now() - hud.hitMark < 180;

  const restart = () => {
    if (props.net && (props.mode === "duel" || props.mode === "coop")) {
      sendEvent(props.net.channelRef.current, { type: "restart", from: me });
    }
    startRef.current();
  };

  return (
    <div className="fixed inset-0 z-40 bg-background" data-scene-ready="1">
      <Canvas
        shadows
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: map.night ? 1.25 : 1.05 }}
        dpr={[1, 2]}
        camera={{ fov: 75, near: 0.05, position: [0, EYE, 0] }}
      >
        <World {...props} api={api} startRef={startRef} resumeRef={resumeRef} paused={paused} touchInput={touchInput} reloadRef={reloadRef} />
      </Canvas>

      <TouchControls
        input={touchInput.current}
        scopedWeapon={weapon.scope}
        onReload={() => reloadRef.current()}
      />

      {hud.aiming && (
        <div className="fps-scope">
          <span className="fps-scope-line-h" />
          <span className="fps-scope-line-v" />
          <span className="fps-scope-dot" />
        </div>
      )}
      {hurtRecent && <div className="mso-hurt" />}

      <div className="pointer-events-none fixed inset-0 z-10 select-none">
        {/* top bar */}
        <div className="flex items-start justify-between gap-4 p-4">
          <div className="flex flex-col gap-2">
            <div className="mso-chip">
              <span className="mso-chip-label">{props.mode === "train" ? "TRAINING" : props.mode === "duel" ? "1v1 DUEL" : props.mode === "coop" ? "CO-OP" : "DUNGEON"}</span>
              <span>{map.name}</span>
            </div>
            {(props.mode === "dungeon" || props.mode === "coop") && (
              <div className="mso-chip">
                <span className="mso-chip-label">WAVE</span>
                <span className="mso-num">{hud.wave}</span>
                <span className="opacity-70">· {hud.enemiesLeft} left</span>
              </div>
            )}
          </div>

          {props.mode === "train" && (
            <div className="mso-panel px-6 py-2 text-center">
              <div className="mso-num text-4xl">{hud.time}</div>
              <div className="text-xs font-bold tracking-widest opacity-70">SECONDS</div>
            </div>
          )}
          {props.mode === "duel" && (
            <div className="mso-panel flex items-center gap-4 px-5 py-2">
              <div className="text-center">
                <div className="text-xs font-bold opacity-70">{props.playerName}</div>
                <div className="mso-num text-3xl text-[var(--mso-ally)]">{hud.duel[me] ?? 0}</div>
              </div>
              <div className="mso-num text-lg opacity-60">VS</div>
              <div className="text-center">
                <div className="text-xs font-bold opacity-70">
                  {props.net?.roster.find((r) => r.id !== me)?.name ?? "Waiting…"}
                </div>
                <div className="mso-num text-3xl text-[var(--mso-foe)]">
                  {Object.entries(hud.duel).filter(([k]) => k !== me).reduce((a, [, v]) => Math.max(a, v), 0)}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-end gap-2">
            <div className="mso-chip">
              <span className="mso-coin" />
              <span className="mso-num">{props.credits}</span>
              {hud.earned > 0 && <span className="text-[var(--mso-ally)]">+{hud.earned}</span>}
            </div>
            <div className="flex flex-col items-end gap-1">
              {hud.feed.map((f) => (
                <div key={f.id} className="mso-feed">{f.text}</div>
              ))}
            </div>
          </div>
        </div>

        {/* banner */}
        {hud.banner && (
          <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
            <div className="mso-banner">{hud.banner}</div>
            {hud.sub && <div className="mso-sub">{hud.sub}</div>}
          </div>
        )}

        {/* crosshair */}
        {!hud.aiming && hud.locked && (
          <div className={`mso-cross ${hitRecent ? "mso-cross-hit" : ""}`}>
            <span /><span /><span /><span />
          </div>
        )}

        {/* bottom HUD */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-5">
          <div className="mso-panel w-72 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold tracking-widest opacity-70">HEALTH</span>
              <span className="mso-num text-3xl">{hud.hp}</span>
            </div>
            <div className="mso-bar mt-1">
              <div className="mso-bar-fill" style={{ width: `${hud.hp}%`, background: hud.hp > 35 ? "var(--mso-ally)" : "var(--mso-foe)" }} />
            </div>
            <div className="mt-2 flex justify-between text-xs font-bold opacity-80">
              <span>{props.playerName}</span>
              <span>{hud.kills} KILLS{props.mode === "train" ? ` · ${acc}%` : ""}</span>
            </div>
          </div>
          <div className="mso-panel w-64 p-3 text-right">
            <div className="text-xs font-bold tracking-widest opacity-70">{weapon.name.toUpperCase()}</div>
            <div className="mso-num text-5xl leading-none">
              {hud.reloading ? <span className="text-2xl">RELOADING…</span> : <>{hud.ammo}<span className="text-2xl opacity-60"> / {weapon.mag}</span></>}
            </div>
            <div className="mt-1 text-xs opacity-70">R reload{weapon.scope ? " · Right-click scope" : ""}</div>
          </div>
        </div>

        {/* paused / click to fight */}
        {paused && (
          <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/60">
            <h2 className="mso-banner">PAUSED</h2>
            <p className="font-bold">Click or tap FIGHT to start</p>
            <p className="max-w-md text-center text-sm text-muted-foreground">
              WASD move · Space jump · Shift sprint · Click shoot · R reload{weapon.scope ? " · Hold right-click to scope" : ""} · Esc pause
            </p>
            <div className="pointer-events-auto flex gap-3">
              <Button type="button" className="mso-btn" onClick={() => resumeRef.current()}>FIGHT</Button>
              <button type="button" className="mso-btn mso-btn-ghost" onClick={props.onExit}>Leave</button>
            </div>
          </div>
        )}

        {/* game over */}
        {hud.over && (
          <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/75">
            <h2 className="mso-banner text-7xl">{hud.over.title}</h2>
            <div className="mso-panel flex flex-col gap-1 px-8 py-4 text-center text-lg font-bold">
              {hud.over.lines.map((l) => <div key={l}>{l}</div>)}
            </div>
            <div className="flex gap-3">
              <button type="button" className="mso-btn" onClick={restart}>PLAY AGAIN</button>
              <button type="button" className="mso-btn mso-btn-ghost" onClick={props.onExit}>BACK TO LOBBY</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
