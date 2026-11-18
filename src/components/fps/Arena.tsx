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
import { enemyBehaviorForWave, scaledTier, scaledUndergroundTier, spawnPlan, undergroundSpawnPlan, UNDERGROUND_ROOM_HALF_SIZE, type Difficulty, type DungeonVariant } from "@/game/sim/waves";
import { Scene, UndergroundScene } from "./Scene";
import { EnemyMesh, RemoteMesh, type EnemyRuntime, type RemoteRuntime } from "./Actors";
import { TouchControls, type TouchInput } from "./TouchControls";
import { Button } from "@/components/ui/button";
import { CharacterPreview } from "@/components/game/CharacterPreview";
import { GameChat, type GameChatMessage } from "@/components/game/GameChat";
import { ExperienceBar } from "@/components/game/ExperienceBar";
import { DUNGEON_WAVES, enemyExperience } from "@/game/sim/progression";
import { playExperiencePickup, playLevelUp } from "@/game/audio";
import { isCoordinator, playerId, sendEvent, sendState, type NetBus, type NetEvent, type RosterEntry } from "@/game/net";
import { HOTBAR_ITEMS, type HotbarInventory } from "@/game/sim/hotbar";
import { getWeaponSkin, type WeaponSkinId } from "@/game/sim/gacha";
import type { AvatarColors } from "@/game/sim/avatar";

export type ArenaMode = "dungeon" | "train" | "coop" | "duel";
type ControlMode = "pc" | "mobile";

export interface ArenaSessionStats {
  seconds: number;
  kills: number;
  deaths: number;
}

export interface NetLink {
  channelRef: MutableRefObject<RealtimeChannel | null>;
  bus: MutableRefObject<NetBus>;
  roster: RosterEntry[];
}

export interface ArenaProps {
  mode: ArenaMode;
  dungeonVariant?: DungeonVariant;
  map: MapId;
  difficulty: Difficulty;
  trainLevel?: number; // 1..5
  weapon: WeaponId;
  playerName: string;
  credits: number;
  level?: number;
  experience?: number;
  equippedShirt?: string | null;
  equippedHat?: string | null;
  equippedPants?: string | null;
  equippedBoots?: string | null;
  equippedWeaponSkin?: WeaponSkinId | null;
  avatarColors?: AvatarColors | undefined;
  armourReduction?: number;
  net?: NetLink;
  onWaveCleared?: (wave: number) => Promise<{ awarded: number; experience: number; levelsGained?: number; level?: number }> | { awarded: number; experience: number; levelsGained?: number; level?: number } | undefined;
  onExperienceCollected?: (amount: number) => Promise<{ levelsGained: number; level: number }>;
  onDungeonKill?: (tier: "grunt" | "runner" | "brute" | "enchanter") => void;
  onBookFound?: () => void;
  hotbar: HotbarInventory;
  ownedSwords?: string[];
  equippedKnife?: string | null;
  onEquipKnife?: (itemId: string) => void;
  onSelectHotbarSlot: (slot: number) => void;
  onDropHotbarItem: () => boolean;
  onToggleAvatar?: () => void;
  onRestart?: () => void;
  onExit: (stats: ArenaSessionStats) => void | Promise<void>;
  onChatMessage?: (message: GameChatMessage) => void;
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

function World(
  props: ArenaProps & {
    api: Api;
    startRef: MutableRefObject<() => void>;
    resumeRef: MutableRefObject<() => void>;
    controlMode: MutableRefObject<ControlMode | null>;
    touchInput: MutableRefObject<TouchInput>;
    reloadRef: MutableRefObject<() => void>;
    statsRef: MutableRefObject<ArenaSessionStats>;
    paused: boolean;
  },
) {
  const { mode, difficulty, net, api } = props;
  const underground = mode === "dungeon" && props.dungeonVariant === "underground";
  const weapon = WEAPONS[props.weapon];
  const reducedDamage = (damage: number) =>
    Math.max(1, Math.round(damage * (1 - (props.armourReduction ?? 0) / 100)));
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
  const magazine = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const fx = useRef<THREE.Group>(null);
  const tracers = useRef<{ m: THREE.Mesh; dir: THREE.Vector3; left: number }[]>([]);
  const sparks = useRef<{ m: THREE.Mesh; life: number }[]>([]);
  const ray = useMemo(() => new THREE.Raycaster(), []);

  // enemies
  const enemies = useRef<EnemyRuntime[]>([]);
  const [enemyKeys, setEnemyKeys] = useState<string[]>([]);
  const experienceOrbs = useRef<
    { id: number; position: THREE.Vector3; value: number; phase: number; collecting: boolean }[]
  >([]);
  const collectingExperience = useRef(false);
  const [experienceOrbKeys, setExperienceOrbKeys] = useState<number[]>([]);
  const experienceOrbMeshes = useRef(new Map<number, THREE.Mesh>());
  const bookPickupRoom = useRef(0);
  const nextExperienceOrbId = useRef(0);
  const wave = useRef(0);
  const waveSeed = useRef(0);
  const nextWaveAt = useRef(-1);
  const clearedWave = useRef(0);
  const runCredits = useRef(0);
  const runExperience = useRef(0);
  const runRewardSaveFailed = useRef(false);
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
  const nameOf = (id: string) => (id === playerId() ? props.playerName : (rosterRef.current.find((r) => r.id === id)?.name ?? "Player"));

  // ---- spawning ----
  const spawnPoint = useCallback((): [number, number] => {
    if (mode === "duel") {
      const ids = rosterRef.current.map((r) => r.id).sort();
      const idx = Math.max(0, ids.indexOf(playerId()));
      const corners: [number, number][] = [
        [-30, -30],
        [30, 30],
        [30, -30],
        [-30, 30],
      ];
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
      const s = underground
        ? scaledUndergroundTier(difficulty, tier, wave.current)
        : scaledTier(difficulty, tier);
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
      };
    },
    [difficulty, mode, underground, props.trainLevel],
  );

  const syncEnemyKeys = () => setEnemyKeys(enemies.current.map((e) => `${wave.current}:${e.id}`));

  function dropExperienceOrb(enemy: EnemyRuntime) {
    if (mode !== "dungeon" && mode !== "coop") return;
    const id = nextExperienceOrbId.current++;
    experienceOrbs.current.push({
      id,
      position: new THREE.Vector3(enemy.x, 0.65, enemy.z),
      value: enemyExperience(enemy.tier),
      phase: Math.random() * Math.PI * 2,
      collecting: false,
    });
    setExperienceOrbKeys(experienceOrbs.current.map((orb) => orb.id));
  }

  const startWave = useCallback(
    (n: number, seed: number) => {
      wave.current = n;
      waveSeed.current = seed;
      nextWaveAt.current = -1;
      const plan = underground
        ? undergroundSpawnPlan(difficulty, n, seed)
        : spawnPlan(difficulty, n, seed);
      enemies.current = plan.map((p) => makeEnemy(p.id, p.tier, p.x, p.z));
      syncEnemyKeys();
      api.patch({
        wave: n,
        enemiesLeft: enemies.current.length,
        banner: `${underground ? "ROOM" : "WAVE"} ${n}`,
        sub: underground
          ? `${enemies.current.length} zombies in the chamber`
          : `${enemies.current.length} enemies incoming`,
      });
      setTimeout(() => api.patch({ banner: null, sub: null }), 2200);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, difficulty, makeEnemy, mode, underground],
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
    props.statsRef.current = { seconds: 0, kills: 0, deaths: 0 };
    clearedWave.current = 0;
    runCredits.current = 0;
    runExperience.current = 0;
    runRewardSaveFailed.current = false;
    experienceOrbs.current = [];
    bookPickupRoom.current = 0;
    experienceOrbMeshes.current.clear();
    setExperienceOrbKeys([]);
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
        sendEvent(net?.channelRef.current ?? null, {
          type: "wave",
          from: playerId(),
          wave: 1,
          seed,
        });
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
    touchMode.current = props.controlMode.current === "mobile";
    if (touchMode.current) {
      api.patch({ locked: true });
      return;
    }
    api.patch({ locked: true });
    const request = gl.domElement.requestPointerLock?.();
    if (request && typeof request.catch === "function") {
      void request.catch(() => api.patch({ locked: true }));
    }
  };

  useEffect(() => {
    camera.rotation.order = "YXZ";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- network events ----
  useEffect(() => {
    if (!net) return;
    net.bus.current.onState = (s) => {
      let r = remotes.current.get(s.id);
      if (!r) {
        r = {
          id: s.id,
          name: s.name,
          x: s.x,
          y: s.y,
          z: s.z,
          ry: s.ry,
          tx: s.x,
          ty: s.y,
          tz: s.z,
          tr: s.ry,
          hp: s.hp,
          seen: false,
        };
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
          dropExperienceOrb(en);
          api.feed(`${e.name} ▸ ${en.tier.toUpperCase()}`);
          api.patch({ enemiesLeft: enemies.current.filter((x) => x.alive).length });
        }
      } else if (e.type === "duelhit" && mode === "duel") {
        if (e.to !== playerId() || dead.current || over.current) return;
        hp.current = Math.max(0, hp.current - reducedDamage(e.dmg));
        api.patch({ hp: hp.current, hurt: Date.now() });
        if (hp.current <= 0) {
          dead.current = true;
          props.statsRef.current.deaths++;
          respawnAt.current = clock.current + 3;
          duelScore.current = {
            ...duelScore.current,
            [e.from]: (duelScore.current[e.from] ?? 0) + 1,
          };
          const killerName = nameOf(e.from);
          sendEvent(net.channelRef.current, {
            type: "frag",
            from: playerId(),
            killer: e.from,
            killerName,
            victimName: props.playerName,
          });
          api.feed(`${killerName} ▸ ${props.playerName}`);
          api.patch({ duel: duelScore.current, banner: "ELIMINATED", sub: `by ${killerName}` });
          checkDuelEnd();
        }
      } else if (e.type === "frag" && mode === "duel") {
        duelScore.current = {
          ...duelScore.current,
          [e.killer]: (duelScore.current[e.killer] ?? 0) + 1,
        };
        api.feed(`${e.killerName} ▸ ${e.victimName}`);
        api.patch({ duel: duelScore.current });
        if (e.killer === playerId()) {
          api.patch({ banner: "ELIMINATION", sub: `+1 vs ${e.victimName}` });
          setTimeout(() => api.patch({ banner: null, sub: null }), 1500);
        }
        checkDuelEnd();
      } else if (e.type === "restart") {
        begin();
      } else if (e.type === "chat") {
        if (e.from !== playerId()) {
          props.onChatMessage?.({
            id: e.id,
            name: e.name.slice(0, 32),
            text: e.text.slice(0, 240),
          });
        }
      }
    };
    return () => {
      net.bus.current.onState = undefined;
      net.bus.current.onEvent = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, mode, startWave, begin, props.onChatMessage]);

  function checkDuelEnd() {
    for (const [id, s] of Object.entries(duelScore.current)) {
      if (s >= DUEL_TARGET) {
        over.current = true;
        const won = id === playerId();
        document.exitPointerLock?.();
        api.patch({
          banner: null,
          sub: null,
          over: {
            title: won ? "VICTORY" : "DEFEAT",
            lines: [`${nameOf(id)} wins the duel ${s}–${otherScore(id)}`],
          },
        });
      }
    }
  }
  function otherScore(id: string) {
    return Object.entries(duelScore.current)
      .filter(([k]) => k !== id)
      .reduce((a, [, v]) => Math.max(a, v), 0);
  }

  // remote roster → avatars
  useEffect(() => {
    if (!online) return;
    const ids = roster.map((r) => r.id).filter((id) => id !== playerId());
    for (const id of [...remotes.current.keys()]) if (!ids.includes(id)) remotes.current.delete(id);
    for (const id of ids) {
      if (!remotes.current.has(id)) {
        const name = roster.find((r) => r.id === id)?.name ?? "Player";
        remotes.current.set(id, {
          id,
          name,
          x: 0,
          y: EYE,
          z: 0,
          ry: 0,
          tx: 0,
          ty: EYE,
          tz: 0,
          tr: 0,
          hp: MAX_HP,
          seen: false,
        });
      }
    }
    setRemoteIds(ids);
  }, [roster, online]);

  // ---- input ----
  useEffect(() => {
    const el = gl.domElement;
    const kd = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      keys.current[e.code] = true;
      if (e.code === "Space") e.preventDefault();
      if (e.code === "KeyR") startReload();
      if (e.code.startsWith("Digit")) {
        const digit = Number(e.code.slice(5));
        if (digit >= 1 && digit <= 9) props.onSelectHotbarSlot(digit - 1);
      }
      if (e.code === "KeyQ" && !props.paused) {
        const dropped = props.onDropHotbarItem();
        api.feed(
          dropped
            ? "ITEM DROPPED"
            : props.hotbar.selected === 8
              ? "THE BUNDLE CANNOT BE DROPPED"
              : "NO ITEM IN THIS SLOT",
        );
      }
      if (e.code === "F5") {
        e.preventDefault();
        props.onToggleAvatar?.();
      }
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
  }, [
    gl,
    weapon,
    props.onDropHotbarItem,
    props.onSelectHotbarSlot,
    props.onToggleAvatar,
    props.paused,
    props.hotbar.selected,
  ]);

  function startReload() {
    if (reload.current > 0 || ammo.current === weapon.mag || dead.current) return;
    reload.current = weapon.reloadTime;
    api.patch({ reloading: true });
  }
  props.reloadRef.current = startReload;

  function addSpark(at: THREE.Vector3, hot: boolean, arcane = false) {
    const m = new THREE.Mesh(
      sparkGeo,
      new THREE.MeshBasicMaterial({
        color: arcane ? "#c58aff" : hot ? "#ff5a36" : "#fff1c4",
        transparent: true,
      }),
    );
    m.position.copy(at);
    fx.current?.add(m);
    sparks.current.push({ m, life: 0.3 });
  }

  function killEnemy(en: EnemyRuntime, mine: boolean) {
    en.alive = false;
    en.hp = 0;
    dropExperienceOrb(en);
    if (mine) {
      kills.current++;
      props.statsRef.current.kills++;
      api.feed(`${props.playerName} ▸ ${mode === "train" ? "DUMMY" : en.tier.toUpperCase()}`);
      if (mode === "dungeon" && underground) props.onDungeonKill?.(en.tier);
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
      api.patch({
        kills: kills.current,
        enemiesLeft: enemies.current.filter((x) => x.alive).length,
      });
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
      const dir = new THREE.Vector3((Math.random() - 0.5) * 2 * spread, (Math.random() - 0.5) * 2 * spread, -1).normalize().applyQuaternion(camera.quaternion);
      ray.set(camera.position, dir);
      ray.far = 160;
      const hit = ray.intersectObjects(scene.children, true).find((h) => {
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
      sendEvent(net?.channelRef.current ?? null, {
        type: "duelhit",
        from: playerId(),
        to: killedRemote,
        dmg: remoteDmg,
      });
    }
    if (landed) hits.current++;
    api.patch({
      ammo: ammo.current,
      shots: shots.current,
      hits: hits.current,
      ...(landed ? { hitMark: Date.now() } : {}),
    });
    if (!weapon.auto) {
      firing.current = false;
      touch.current.firing = false;
    }
    if (ammo.current <= 0) startReload();
  }

  async function waveDone(n: number) {
    if (clearedWave.current >= n) return;
    clearedWave.current = n;
    const finalDungeonWave = mode === "dungeon" && n >= DUNGEON_WAVES;
    if (finalDungeonWave) {
      over.current = true;
      document.exitPointerLock?.();
    }
    let reward = { awarded: 0, experience: 0, levelsGained: 0, level: props.level ?? 1 };
    try {
      const savedReward = await props.onWaveCleared?.(n);
      if (savedReward) reward = { ...reward, ...savedReward };
    } catch (error) {
      runRewardSaveFailed.current = true;
      api.feed(error instanceof Error ? `REWARD SAVE FAILED: ${error.message}` : "REWARD SAVE FAILED");
    }
    runCredits.current += reward.awarded;
    runExperience.current += reward.experience;
    if (reward.levelsGained > 0) playLevelUp();
    if (finalDungeonWave) {
      api.patch((h) => ({
        banner: null,
        sub: null,
        earned: h.earned + reward.awarded,
        over: {
          title: "DUNGEON COMPLETE",
          lines: [
            `All ${DUNGEON_WAVES} ${props.dungeonVariant === "underground" ? "rooms" : "waves"} cleared`,
            `Coins earned: ${runCredits.current}`,
            `EXP earned: ${runExperience.current}`,
            ...(runRewardSaveFailed.current ? ["Reward save failed; totals may be incomplete"] : []),
            ...(reward.levelsGained > 0 ? [`LEVEL UP! You reached Level ${reward.level}`] : []),
          ],
        },
      }));
      return;
    }
    api.patch((h) => ({
      banner: reward.levelsGained ? "LEVEL UP!" : `WAVE ${n} CLEARED`,
      sub: reward.levelsGained ? `LEVEL ${reward.level} · +${reward.awarded} COINS · +${reward.experience} EXP` : reward.awarded ? `+${reward.awarded} COINS · +${reward.experience} EXP` : "Next wave incoming",
      earned: h.earned + reward.awarded,
    }));
    setTimeout(() => api.patch({ banner: null, sub: null }), 2500);
  }

  // ---- the one stepper ----
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    clock.current += dt;
    touchMode.current = props.controlMode.current === "mobile";
    const k = keys.current;
    const live = !props.paused && !over.current;
    if (live) props.statsRef.current.seconds += dt;

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
    const under =
      !underground &&
      CRATES.find(
        (c) =>
          Math.abs(camera.position.x - c.x) < c.s / 2 + 0.3 &&
          Math.abs(camera.position.z - c.z) < c.s / 2 + 0.3,
      );
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
      if (underground || !blocked(nx, camera.position.z, feet)) camera.position.x = nx;
      if (underground || !blocked(camera.position.x, nz, feet)) camera.position.z = nz;
      const arenaLimit = underground ? UNDERGROUND_ROOM_HALF_SIZE - 0.7 : ARENA - 0.5;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -arenaLimit, arenaLimit);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -arenaLimit, arenaLimit);
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
        api.patch({
          over: {
            title: "DRILL COMPLETE",
            lines: [`${kills.current} dummies down`, `${acc}% accuracy`, `${shots.current} shots fired`],
          },
        });
      }
    }

    if (live && !dead.current && props.onExperienceCollected && !collectingExperience.current) {
      for (const orb of experienceOrbs.current) {
        const mesh = experienceOrbMeshes.current.get(orb.id);
        if (!mesh || orb.collecting) continue;
        mesh.position.y = orb.position.y + Math.sin(clock.current * 4 + orb.phase) * 0.12;
        mesh.rotation.y += dt * 2.4;
        if (mesh.position.distanceTo(camera.position) > 1.65) continue;

        orb.collecting = true;
        collectingExperience.current = true;
        void props
          .onExperienceCollected(orb.value)
          .then(({ levelsGained, level }) => {
            playExperiencePickup();
            runExperience.current += orb.value;
            if (levelsGained > 0) {
              playLevelUp();
              api.patch({ banner: "LEVEL UP!", sub: `LEVEL ${level} · +${orb.value} EXP` });
            } else {
              api.patch({ banner: `+${orb.value} EXP`, sub: "EXPERIENCE ORB" });
            }
            setTimeout(() => api.patch({ banner: null, sub: null }), 1800);
            experienceOrbs.current = experienceOrbs.current.filter((item) => item.id !== orb.id);
            experienceOrbMeshes.current.delete(orb.id);
            setExperienceOrbKeys(experienceOrbs.current.map((item) => item.id));
          })
          .catch((error: unknown) => {
            orb.collecting = false;
            api.feed(error instanceof Error ? `XP SAVE FAILED: ${error.message}` : "XP SAVE FAILED");
          })
          .finally(() => {
            collectingExperience.current = false;
          });
        break;
      }
    }

    if (
      underground &&
      live &&
      !dead.current &&
      wave.current > 0 &&
      bookPickupRoom.current !== wave.current &&
      Math.hypot(camera.position.x + 13.2, camera.position.z + 3) < 1.7
    ) {
      bookPickupRoom.current = wave.current;
      props.onBookFound?.();
      api.feed("ENCHANTING BOOK FOUND");
    }

    // enemies AI
    const me = camera.position;
    const targets: { x: number; z: number; local: boolean }[] = [];
    if (!dead.current) targets.push({ x: me.x, z: me.z, local: true });
    for (const r of remotes.current.values()) if (r.seen && r.hp > 0) targets.push({ x: r.x, z: r.z, local: false });

    let aliveCount = 0;
    for (const e of enemies.current) {
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
      if ((mode === "dungeon" || mode === "coop") && !underground && !dead.current) {
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
            hp.current = Math.max(0, hp.current - reducedDamage(e.damage));
            api.patch({ hp: hp.current, hurt: Date.now() });
            if (hp.current <= 0) {
              dead.current = true;
              props.statsRef.current.deaths++;
              if (mode === "dungeon") {
                over.current = true;
                document.exitPointerLock?.();
                api.patch((h) => ({
                  over: {
                    title: "YOU DIED",
                    lines: [`Reached ${props.dungeonVariant === "underground" ? "room" : "wave"} ${wave.current}`, `${kills.current} enemies down`, `+${h.earned} credits this run`],
                  },
                }));
              } else {
                respawnAt.current = clock.current + 5;
                api.patch({ banner: "DOWNED", sub: "Back in 5s" });
              }
            }
          }
        }
      }
      if (
        underground &&
        e.tier === "enchanter" &&
        chasing?.local &&
        dist > 3 &&
        dist < 15 &&
        e.attackCd <= 0
      ) {
        e.attackCd = 3.2;
        e.ry = Math.atan2(dx, dz);
        const origin = new THREE.Vector3(
          e.x + Math.sin(e.ry) * 0.45,
          1.65,
          e.z + Math.cos(e.ry) * 0.45,
        );
        const target = new THREE.Vector3(me.x, me.y - 0.15, me.z);
        const direction = target.clone().sub(origin).normalize();
        const magicBolt = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 10, 10),
          new THREE.MeshBasicMaterial({ color: "#b56aff", transparent: true }),
        );
        magicBolt.position.copy(origin);
        fx.current?.add(magicBolt);
        tracers.current.push({ m: magicBolt, dir: direction, left: origin.distanceTo(target) });
        hp.current = Math.max(0, hp.current - reducedDamage(e.damage));
        addSpark(target, false, true);
        for (let particle = 0; particle < 4; particle++) {
          addSpark(
            target
              .clone()
              .add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * 0.9,
                  (Math.random() - 0.5) * 0.9,
                  (Math.random() - 0.5) * 0.9,
                ),
              ),
            false,
            true,
          );
        }
        api.patch({ hp: hp.current, hurt: Date.now() });
        api.feed("ENCHANTER ▸ ARCANE WAVE");
        if (hp.current <= 0) {
          dead.current = true;
          props.statsRef.current.deaths++;
          over.current = true;
          document.exitPointerLock?.();
          api.patch((h) => ({
            over: {
              title: "YOU DIED",
              lines: [
                `Reached room ${wave.current}`,
                `${kills.current} enemies down`,
                `+${h.earned} credits this run`,
              ],
            },
          }));
        }
      }

      if (chasing && dist < e.reach) {
        e.moving = false;
        e.ry = Math.atan2(dx, dz);
        if (e.cd <= 0 && chasing.local && !dead.current && Math.abs(me.y - EYE) < 2.2) {
          e.cd = 1.1;
          hp.current = Math.max(0, hp.current - reducedDamage(Math.max(2, Math.round(e.damage * 0.55))));
          api.patch({ hp: hp.current, hurt: Date.now() });
          if (hp.current <= 0) {
            dead.current = true;
            props.statsRef.current.deaths++;
            if (mode === "dungeon") {
              over.current = true;
              document.exitPointerLock?.();
              api.patch((h) => ({
                over: {
                  title: "YOU DIED",
                  lines: [`Reached ${props.dungeonVariant === "underground" ? "room" : "wave"} ${wave.current}`, `${kills.current} enemies down`, `+${h.earned} credits this run`],
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
      if (chasing && (mode === "dungeon" || mode === "coop") && !underground && dist > 0.01) {
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
      const hitX = !underground && blocked(nx, e.z, 0, 0.45);
      const hitZ = !underground && blocked(e.x, nz, 0, 0.45);
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
        const finalDungeonWave = mode === "dungeon" && wave.current >= DUNGEON_WAVES;
        if (finalDungeonWave) {
          api.patch({ banner: "WAVE CLEARED", sub: "Collect the remaining EXP orbs!" });
        } else {
          void waveDone(wave.current);
        }
      } else if (clock.current >= nextWaveAt.current) {
        if (mode === "dungeon" && wave.current >= DUNGEON_WAVES) {
          void waveDone(wave.current);
          nextWaveAt.current = -1;
        } else {
          const needsRoomTransition =
            underground && (Math.abs(camera.position.x) > 3 || camera.position.z > -15.5);
          if (needsRoomTransition) {
            nextWaveAt.current = clock.current + 0.5;
            api.patch({ banner: "NEXT ROOM", sub: "FOLLOW THE ARROW TO THE STAIRWAY" });
          } else {
            if (underground) {
              camera.position.set(0, EYE, 0);
              vy.current = 0;
            }
            const coordinator = mode === "dungeon" || isCoordinator(rosterRef.current);
            if (coordinator) {
              const seed = Math.floor(Math.random() * 1e9);
              const n = wave.current + 1;
              if (mode === "coop")
                sendEvent(net?.channelRef.current ?? null, {
                  type: "wave",
                  from: playerId(),
                  wave: n,
                  seed,
                });
              startWave(n, seed);
            } else {
              nextWaveAt.current = clock.current + 2; // wait for the coordinator's wave event
            }
          }
        }
      }
    }

    // gun pose
    recoil.current *= Math.exp(-12 * dt);
    const bob = move.lengthSq() && grounded ? Math.sin(state.clock.elapsedTime * 12) * 0.015 : 0;
    if (gun.current) {
      const reloadProgress = reload.current > 0 ? 1 - reload.current / weapon.reloadTime : 0;
      const reloadPose = Math.sin(reloadProgress * Math.PI);
      gun.current.visible = !aiming.current && !dead.current;
      gun.current.position.copy(camera.position);
      gun.current.quaternion.copy(camera.quaternion);
      gun.current.translateX(0.25);
      gun.current.translateY(-0.22 + bob - reloadPose * 0.16);
      gun.current.translateZ(-0.5 + recoil.current * 0.08);
      gun.current.rotateX(recoil.current * 0.18 - reloadPose * 0.72);
      gun.current.rotateZ(reloadPose * 0.16);
      if (magazine.current) magazine.current.position.y = -0.1 - reloadPose * 0.28;
    }
    if (flash.current) flash.current.intensity = recoil.current > 0.7 ? 8 : 0;

    // fx
    tracers.current = tracers.current.filter((b) => {
      const step = Math.min(160 * dt, b.left);
      b.m.position.addScaledVector(b.dir, step);
      b.left -= step;
      if (b.left <= 0) {
        fx.current?.remove(b.m);
        if (b.m.material !== bulletMat) {
          b.m.geometry.dispose();
          (b.m.material as THREE.Material).dispose();
        }
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
  const gunCol = getWeaponSkin(props.equippedWeaponSkin ?? null)?.color ??
    (weapon.id === "riot-shotgun" ? "#5a3a22" : weapon.id === "vector-smg" ? "#2a2d33" : weapon.id === "longbow-sniper" ? "#3b4a33" : "#3a3d40");

  return (
    <>
      {underground ? <UndergroundScene room={wave.current} /> : <Scene map={MAPS[props.map]} />}
      {enemyKeys.map((key) => {
        const id = Number(key.split(":")[1]);
        const e = enemies.current.find((x) => x.id === id);
        return e ? <EnemyMesh key={key} e={e} zombie={underground} /> : null;
      })}
      {experienceOrbKeys.map((id) => (
        <mesh
          key={`xp-${id}`}
          ref={(mesh) => {
            if (mesh) experienceOrbMeshes.current.set(id, mesh);
            else experienceOrbMeshes.current.delete(id);
          }}
          position={experienceOrbs.current.find((orb) => orb.id === id)?.position ?? [0, -100, 0]}
        >
          <icosahedronGeometry args={[0.16, 1]} />
          <meshStandardMaterial color="#80ff20" emissive="#80ff20" emissiveIntensity={2.2} />
          <pointLight color="#80ff20" intensity={0.55} distance={2.5} />
        </mesh>
      ))}
      {underground && bookPickupRoom.current !== wave.current && (
        <group position={[-13.2, 1.35, -3]}>
          <mesh rotation-x={-0.18} rotation-z={-0.12} castShadow>
            <boxGeometry args={[0.42, 0.08, 0.32]} />
            <meshStandardMaterial color="#512e71" emissive="#6f32a5" emissiveIntensity={0.65} />
          </mesh>
          <mesh position={[0, 0.08, 0]} rotation-x={-0.18} rotation-z={-0.12}>
            <boxGeometry args={[0.38, 0.025, 0.29]} />
            <meshStandardMaterial color="#c7a8e8" roughness={0.75} />
          </mesh>
          <pointLight color="#9b55e8" intensity={0.7} distance={2.2} />
        </group>
      )}
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
        <mesh ref={magazine} position={[0, -0.1, -0.02]}>
          <boxGeometry args={[0.045, 0.14, 0.06]} />
          <meshStandardMaterial color="#1c2023" metalness={0.55} roughness={0.48} />
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
  const [knifeMenu, setKnifeMenu] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([]);
  const feedId = useRef(0);
  const startRef = useRef<() => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});
  const controlModeRef = useRef<ControlMode | null>(null);
  const [controlMode, setControlMode] = useState<ControlMode | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [avatarVisible, setAvatarVisible] = useState(false);
  const statsRef = useRef<ArenaSessionStats>({ seconds: 0, kills: 0, deaths: 0 });
  const exiting = useRef(false);
  const reloadRef = useRef<() => void>(() => {});
  const touchInput = useRef<TouchInput>({
    moveX: 0,
    moveY: 0,
    lookDX: 0,
    lookDY: 0,
    firing: false,
    jump: false,
    aiming: false,
  });
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

  useEffect(() => {
    const openKnifeMenu = (event: KeyboardEvent) => {
      if (event.code === "KeyF") setKnifeMenu((open) => !open);
      if (event.code === "KeyT" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        setChatOpen((open) => !open);
        document.exitPointerLock?.();
      }
    };
    addEventListener("keydown", openKnifeMenu);
    return () => removeEventListener("keydown", openKnifeMenu);
  }, []);

  const receiveChatMessage = useCallback((message: GameChatMessage) => {
    setChatMessages((messages) => [...messages.slice(-7), message]);
  }, []);

  const sendChatMessage = (text: string) => {
    const message = {
      id: `${playerId()}-${Date.now()}`,
      name: props.playerName,
      text,
    };
    receiveChatMessage(message);
    if (props.net) {
      sendEvent(props.net.channelRef.current, {
        type: "chat",
        from: playerId(),
        ...message,
      });
    }
    setChatOpen(false);
  };

  const paused = !hud.locked && !hud.over;
  const map = MAPS[props.map];
  const acc = hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 0;
  const me = playerId();
  const hurtRecent = Date.now() - hud.hurt < 350;
  const hitRecent = Date.now() - hud.hitMark < 180;

  const restart = () => {
    props.onRestart?.();
    exiting.current = false;
    if (props.net && (props.mode === "duel" || props.mode === "coop")) {
      sendEvent(props.net.channelRef.current, { type: "restart", from: me });
    }
    startRef.current();
    resumeRef.current();
  };

  const leaveArena = async () => {
    if (exiting.current) return;
    exiting.current = true;
    await props.onExit({ ...statsRef.current });
  };

  const chooseControlMode = (mode: ControlMode) => {
    controlModeRef.current = mode;
    setControlMode(mode);
    if (mode === "mobile") document.exitPointerLock?.();
  };
  const enterFight = () => {
    if (!controlModeRef.current) return;
    if (!hasStarted) {
      startRef.current();
      setHasStarted(true);
    }
    resumeRef.current();
  };

  return (
    <div className="fixed inset-0 z-40 bg-background" data-scene-ready="1">
      <Canvas
        shadows
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: props.dungeonVariant === "underground" ? 0.9 : map.night ? 1.25 : 1.05,
        }}
        dpr={[1, 2]}
        camera={{ fov: 75, near: 0.05, position: [0, EYE, 0] }}
      >
        <World
          {...props}
          onToggleAvatar={() => setAvatarVisible((visible) => !visible)}
          api={api}
          startRef={startRef}
          resumeRef={resumeRef}
          controlMode={controlModeRef}
          paused={paused}
          onChatMessage={receiveChatMessage}
          touchInput={touchInput}
          reloadRef={reloadRef}
          statsRef={statsRef}
        />
      </Canvas>

      <TouchControls input={touchInput.current} scopedWeapon={weapon.scope} active={controlMode === "mobile"} onReload={() => reloadRef.current()} />
      <GameChat
        open={chatOpen}
        messages={chatMessages}
        onSend={sendChatMessage}
        onClose={() => setChatOpen(false)}
      />
      {avatarVisible && (
        <div
          className="fps-third-person-preview"
          role="status"
          aria-label="Third-person character view"
        >
          <CharacterPreview
            shirtId={props.equippedShirt ?? null}
            hatId={props.equippedHat ?? null}
            pantsId={props.equippedPants ?? null}
            bootsId={props.equippedBoots ?? null}
            weaponId={props.weapon}
            avatarColors={props.avatarColors}
            weaponSkinId={props.equippedWeaponSkin}
            rotatable
          />
          <span>THIRD-PERSON PREVIEW · F5 TO HIDE</span>
        </div>
      )}

      {hud.aiming && (
        <div className="fps-scope">
          <span className="fps-scope-line-h" />
          <span className="fps-scope-line-v" />
          <span className="fps-scope-dot" />
        </div>
      )}
      {hurtRecent && <div className="mso-hurt" />}

      <div className="pointer-events-none fixed inset-0 z-10 select-none fps-interface">
        {/* top bar */}
        <div className="fps-topbar flex items-start justify-between gap-4 p-4">
          <div className="flex flex-col gap-2">
            <div className="fps-mode-chip">
              <span className="fps-status-dot" />
              <span>{props.mode === "train" ? "TRAINING" : props.mode === "duel" ? "1V1 DUEL" : props.mode === "coop" ? "CO-OP" : props.dungeonVariant === "underground" ? "UNDERGROUND" : "GUNFIGHT"}</span>
              <span className="fps-chip-divider" />
              <span className="fps-map-name">{props.dungeonVariant === "underground" ? "THE LOWER LEVELS" : map.name}</span>
            </div>
            {(props.mode === "dungeon" || props.mode === "coop") && (
              <div className="fps-wave-chip">
                <span className="fps-micro-label">{props.dungeonVariant === "underground" ? "ROOM" : "WAVE"}</span>
                <span className="mso-num">{String(hud.wave).padStart(2, "0")}</span>
                <span className="fps-wave-divider" />
                <span className="fps-enemies">
                  <i />
                  {hud.enemiesLeft} {props.dungeonVariant === "underground" ? "ZOMBIES" : "HOSTILES"}
                </span>
              </div>
            )}
          </div>

          {props.mode === "train" && (
            <div className="fps-timer-panel px-6 py-2 text-center">
              <div className="mso-num text-4xl">{hud.time}</div>
              <div className="fps-micro-label">SECONDS</div>
            </div>
          )}
          {props.mode === "duel" && (
            <div className="fps-duel-panel flex items-center gap-4 px-5 py-2">
              <div className="text-center">
                <div className="fps-micro-label">{props.playerName}</div>
                <div className="mso-num text-3xl text-[var(--mso-ally)]">{hud.duel[me] ?? 0}</div>
              </div>
              <div className="fps-versus">VS</div>
              <div className="text-center">
                <div className="fps-micro-label">{props.net?.roster.find((r) => r.id !== me)?.name ?? "Waiting…"}</div>
                <div className="mso-num text-3xl text-[var(--mso-foe)]">
                  {Object.entries(hud.duel)
                    .filter(([k]) => k !== me)
                    .reduce((a, [, v]) => Math.max(a, v), 0)}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-end gap-2">
            <div className="fps-credit-chip">
              <span className="fps-credit-symbol" aria-hidden="true">
                ¢
              </span>
              <span className="mso-num">{props.credits}</span>
              {hud.earned > 0 && <span className="text-[var(--mso-ally)]">+{hud.earned}</span>}
            </div>
            <div className="flex flex-col items-end gap-1">
              {hud.feed.map((f) => (
                <div key={f.id} className="mso-feed">
                  {f.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* banner */}
        {hud.banner && (
          <div className={`fps-round-banner absolute left-1/2 top-[22%] -translate-x-1/2 text-center ${hud.banner === "LEVEL UP!" ? "fps-level-up" : ""}`}>
            <div className="mso-banner">{hud.banner}</div>
            {hud.sub && <div className="mso-sub">{hud.sub}</div>}
          </div>
        )}

        {/* crosshair */}
        {!hud.aiming && hud.locked && (
          <div className={`mso-cross ${hitRecent ? "mso-cross-hit" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {props.dungeonVariant === "underground" &&
          hud.enemiesLeft === 0 &&
          hud.wave > 0 &&
          hud.wave < DUNGEON_WAVES && (
            <div className="fps-next-room-arrow" aria-label="Next room is up the stairs">
              ↑ <span>NEXT ROOM</span>
            </div>
          )}

        {/* bottom HUD */}
        <div className="fps-bottom-hud absolute bottom-0 left-0 right-0 flex items-end justify-between p-5">
          <div className={`fps-health-panel ${hud.hp <= 35 ? "fps-health-critical" : ""}`}>
            <div className="fps-player-identity">
              <CharacterPreview
                compact
                shirtId={props.equippedShirt ?? null}
                hatId={props.equippedHat ?? null}
                pantsId={props.equippedPants ?? null}
                bootsId={props.equippedBoots ?? null}
                avatarColors={props.avatarColors}
              />
              <div>
                <span className="fps-micro-label">LEVEL {props.level ?? 1}</span>
                <span className="fps-player-name">
                  <i />
                  {props.playerName}
                </span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="fps-micro-label">VITALS</span>
              <span className="fps-health-value">
                <span>{hud.hp}</span>
                <small> / 100</small>
              </span>
            </div>
            <div className="fps-health-track mt-2" role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hud.hp}>
              <div
                className="mso-bar-fill"
                style={{
                  width: `${hud.hp}%`,
                  background: hud.hp > 35 ? "var(--mso-ally)" : "var(--mso-foe)",
                }}
              />
            </div>
            <div className="fps-player-row mt-3 flex items-center justify-between">
              <span className="fps-player-name">{props.playerName}</span>
              <span className="fps-match-stat">
                <span>
                  <b>{hud.kills}</b> {props.mode === "train" ? "HITS" : "KILLS"}
                </span>
                <span className="fps-stat-divider" />
                <span>
                  <b>{hud.score}</b> SCORE
                </span>
                {props.mode === "train" && (
                  <>
                    <span className="fps-stat-divider" />
                    <span>
                      <b>{acc}%</b> ACC
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
          <div className={`fps-ammo-panel ${hud.reloading ? "fps-is-reloading" : ""}`}>
            <div className="fps-weapon-label">
              <span className="fps-micro-label">EQUIPPED</span>
              <span>{weapon.name.toUpperCase()}</span>
            </div>
            <div className="fps-ammo-readout">
              {hud.reloading ? (
                <span className="fps-reload-label">
                  RELOADING<span className="fps-reload-dots">...</span>
                </span>
              ) : (
                <>
                  <span className="fps-ammo-current">{hud.ammo}</span>
                  <span className="fps-ammo-divider">/</span>
                  <span className="fps-ammo-total">{weapon.mag}</span>
                </>
              )}
            </div>
            <div className="fps-ammo-hint">[ R ] RELOAD{weapon.scope ? "  ·  [ RMB ] SCOPE" : ""}</div>
          </div>
        </div>
        <div className="fps-hotbar" role="toolbar" aria-label="Inventory hotbar">
          {Array.from({ length: 8 }, (_, slot) => {
            const stack = props.hotbar.slots[slot];
            return (
              <button
                key={slot}
                type="button"
                className={`fps-hotbar-slot ${props.hotbar.selected === slot ? "fps-hotbar-selected" : ""}`}
                aria-label={`Slot ${slot + 1}${stack ? `: ${HOTBAR_ITEMS[stack.item].name}, ${stack.count}` : ": empty"}`}
                aria-pressed={props.hotbar.selected === slot}
                onClick={() => props.onSelectHotbarSlot(slot)}
              >
                <span className="fps-hotbar-number">{slot + 1}</span>
                <span className="fps-hotbar-name">
                  {stack ? HOTBAR_ITEMS[stack.item].name : "—"}
                </span>
                {stack && <span className="fps-hotbar-count">{stack.count}</span>}
              </button>
            );
          })}
          <button
            type="button"
            className={`fps-hotbar-slot fps-hotbar-bundle ${props.hotbar.selected === 8 ? "fps-hotbar-selected" : ""}`}
            title={
              props.hotbar.bundle
                .map((stack) => `${HOTBAR_ITEMS[stack.item].name} ×${stack.count}`)
                .join(", ") || "Empty bundle"
            }
            aria-label={`Slot 9 bundle: ${props.hotbar.bundle.reduce((count, stack) => count + stack.count, 0)} of 10 items; cannot be dropped`}
            aria-pressed={props.hotbar.selected === 8}
            onClick={() => props.onSelectHotbarSlot(8)}
          >
            <span className="fps-hotbar-number">9</span>
            <span className="fps-hotbar-name">BUNDLE</span>
            <span className="fps-hotbar-count">
              {props.hotbar.bundle.reduce((count, stack) => count + stack.count, 0)}/10
            </span>
          </button>
        </div>
        {props.hotbar.selected === 8 && props.hotbar.bundle.length > 0 && (
          <div className="fps-hotbar-bundle-contents" aria-live="polite">
            {props.hotbar.bundle
              .map((stack) => `${HOTBAR_ITEMS[stack.item].name} ×${stack.count}`)
              .join(" · ")}
          </div>
        )}
        <button
          type="button"
          className="fps-hotbar-drop"
          disabled={
            paused || props.hotbar.selected === 8 || !props.hotbar.slots[props.hotbar.selected]
          }
          onClick={() => {
            const dropped = props.onDropHotbarItem();
            api.feed(dropped ? "ITEM DROPPED" : "NO ITEM IN THIS SLOT");
          }}
        >
          {props.hotbar.selected === 8 ? "BUNDLE LOCKED" : "DROP [Q]"}
        </button>
        <div className="fps-experience-position">
          <ExperienceBar level={props.level ?? 1} experience={props.experience ?? 0} compact />
        </div>

        {knifeMenu && (
          <div className="knife-selection" role="dialog" aria-label="Choose knife">
            <div className="hub-info-kicker">F · KNIFE LOADOUT</div>
            <h2 className="mso-display text-2xl">SELECT YOUR SWORD</h2>
            <div className="knife-options">
              {(props.ownedSwords?.length ? props.ownedSwords : ["scrap-sword"]).map((itemId) => (
                <button
                  type="button"
                  key={itemId}
                  className={props.equippedKnife === itemId ? "knife-option knife-equipped" : "knife-option"}
                  onClick={() => {
                    props.onEquipKnife?.(itemId);
                    setKnifeMenu(false);
                  }}
                >
                  <span className="knife-blade" />
                  <b>{itemId.replaceAll("-", " ").toUpperCase()}</b>
                  {props.equippedKnife === itemId && <small>EQUIPPED</small>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* paused / click to fight */}
        {paused && (
          <div
            className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/60"
            onClick={(event) => {
              if (event.target === event.currentTarget && controlModeRef.current) enterFight();
            }}
          >
            <h2 className="mso-banner">{hasStarted ? "PAUSED" : "CHOOSE YOUR DEVICE"}</h2>
            <p className="font-bold">{hasStarted ? "Choose your controls, then jump back in" : "How are you playing Mexican Standof?"}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" aria-pressed={controlMode === "pc"} className={`mso-btn ${controlMode === "pc" ? "" : "mso-btn-ghost"}`} onClick={() => chooseControlMode("pc")}>
                PC
              </Button>
              <Button type="button" aria-pressed={controlMode === "mobile"} className={`mso-btn ${controlMode === "mobile" ? "" : "mso-btn-ghost"}`} onClick={() => chooseControlMode("mobile")}>
                MOBILE
              </Button>
            </div>
            {controlMode && (
              <p className="max-w-md text-center text-sm text-muted-foreground">
                {controlMode === "mobile"
                  ? "Left joystick move · Right joystick aim · FIRE · JUMP · R reload"
                  : `WASD move · Mouse aim · Click shoot · Space jump · Shift sprint · R reload · 1-9 select item · Q drop · Bundle protected${weapon.scope ? " · Right-click scope" : ""}`}
              </p>
            )}
            <div className="pointer-events-auto flex gap-3">
              <Button type="button" className="mso-btn" disabled={!controlMode} onClick={enterFight}>
                {hasStarted ? "FIGHT" : "START"}
              </Button>
              {hasStarted && (
                <Button type="button" className="mso-btn mso-btn-ghost" onClick={() => void leaveArena()}>
                  Leave
                </Button>
              )}
            </div>
          </div>
        )}

        {/* game over */}
        {hud.over && (
          <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/75">
            <h2 className="mso-banner text-7xl">{hud.over.title}</h2>
            <div className="mso-panel flex flex-col gap-1 px-8 py-4 text-center text-lg font-bold">
              {hud.over.lines.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
            <div className="flex gap-3">
              {hud.over.title !== "DUNGEON COMPLETE" && (
                <button type="button" className="mso-btn" onClick={restart}>
                  PLAY AGAIN
                </button>
              )}
              <button type="button" className="mso-btn mso-btn-ghost" onClick={() => void leaveArena()}>
                BACK TO LOBBY
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
