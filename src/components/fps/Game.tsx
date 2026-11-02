import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const SPEED = 9;
const ARENA = 40;
const ROUND_TIME = 60;
const EYE = 1.7;
const GRAVITY = 24;
const JUMP_V = 9;
const BULLET_SPEED = 140;
const SENS = 0.0022;
const SCOPE_FOV = 20;

type Target = { id: number; pos: THREE.Vector3; phase: number; down?: boolean };
type Bullet = { id: number; mesh: THREE.Mesh; dir: THREE.Vector3; left: number };
type Spark = { mesh: THREE.Mesh; life: number };

function sandTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9a36b";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const s = Math.random() * 40 - 20;
    g.fillStyle = `rgb(${201 + s},${163 + s},${107 + s})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(20, 20);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crateTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a5a2b";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#5a3818";
  g.lineWidth = 10;
  g.strokeRect(5, 5, 118, 118);
  g.beginPath(); g.moveTo(5, 5); g.lineTo(123, 123); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const CRATES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const r = 10 + (i % 3) * 7;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1.5 + (i % 2) };
});

const BARRELS = Array.from({ length: 14 }, (_, i) => [Math.cos(i * 2.4) * (6 + i * 2), Math.sin(i * 2.4) * (6 + i * 2)]);

function randTarget(id: number): Target {
  return {
    id,
    pos: new THREE.Vector3((Math.random() - 0.5) * ARENA * 1.4, 1.5 + Math.random() * 3, (Math.random() - 0.5) * ARENA * 1.4),
    phase: Math.random() * 6,
  };
}

const bulletGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6).rotateX(Math.PI / 2);
const bulletMat = new THREE.MeshBasicMaterial({ color: "#ffd27a" });
const sparkGeo = new THREE.SphereGeometry(0.15, 8, 8);

function World({ onHit, playing, onAim }: { onHit: () => void; playing: boolean; onAim: (v: boolean) => void }) {
  const { camera, scene, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const [targets, setTargets] = useState<Target[]>(() => Array.from({ length: 8 }, (_, i) => randTarget(i)));
  const nextId = useRef(100);
  const gun = useRef<THREE.Group>(null);
  const muzzle = useRef<THREE.Object3D>(null);
  const fx = useRef<THREE.Group>(null);
  const recoil = useRef(0);
  const flash = useRef<THREE.PointLight>(null);
  const look = useRef({ yaw: 0, pitch: 0 });
  const aiming = useRef(false);
  const vy = useRef(0);
  const bullets = useRef<Bullet[]>([]);
  const sparks = useRef<Spark[]>([]);
  const sand = useMemo(sandTexture, []);
  const crate = useMemo(crateTexture, []);
  const ray = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    camera.position.set(0, EYE, 0);
    camera.rotation.order = "YXZ";
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;
    if (playing) el.requestPointerLock?.();
    else if (aiming.current) { aiming.current = false; onAim(false); }
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true; if (e.code === "Space") e.preventDefault(); };
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const s = SENS * (aiming.current ? 0.35 : 1);
      look.current.yaw -= e.movementX * s;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * s, -1.5, 1.5);
    };
    const aimOn = (e: MouseEvent) => {
      if (!playing || e.button !== 2) return;
      if (document.pointerLockElement !== el) return;
      aiming.current = true; onAim(true);
    };
    const aimOff = (e: MouseEvent) => {
      if (e.button !== 2 || !aiming.current) return;
      aiming.current = false; onAim(false);
    };
    const noCtx = (e: Event) => e.preventDefault();
    const shoot = () => {
      if (!playing) return;
      if (document.pointerLockElement !== el) { el.requestPointerLock?.(); return; }
      recoil.current = 1;
      camera.updateMatrixWorld();
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hits = ray.intersectObjects(scene.children, true)
        .filter((h) => h.object.userData.targetId !== undefined || h.object.userData.solid);
      const hit = hits[0];
      const end = hit ? hit.point.clone() : camera.position.clone().add(ray.ray.direction.clone().multiplyScalar(150));
      // Bullet flies from the muzzle to the exact point under the crosshair
      const start = new THREE.Vector3();
      muzzle.current?.getWorldPosition(start);
      const dir = end.clone().sub(start);
      const dist = dir.length();
      dir.normalize();
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.position.copy(start);
      mesh.lookAt(end);
      fx.current?.add(mesh);
      bullets.current.push({ id: Math.random(), mesh, dir, left: dist });
      if (hit) {
        const s = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: hit.object.userData.targetId !== undefined ? "#ff5a36" : "#fff1c4", transparent: true }));
        s.position.copy(end);
        s.visible = false;
        s.userData.delay = dist / BULLET_SPEED;
        fx.current?.add(s);
        sparks.current.push({ mesh: s, life: 0.35 });
      }
      if (hit && hit.object.userData.targetId !== undefined) {
        const id = hit.object.userData.targetId;
        setTimeout(() => {
          setTargets((ts) => ts.map((t) => (t.id === id ? { ...t, down: true } : t)));
          onHit();
        }, (dist / BULLET_SPEED) * 1000);
      }
    };
    addEventListener("keydown", d);
    addEventListener("keyup", u);
    addEventListener("mousemove", move);
    el.addEventListener("mousedown", shoot);
    el.addEventListener("mousedown", aimOn);
    addEventListener("mouseup", aimOff);
    el.addEventListener("contextmenu", noCtx);
    return () => {
      removeEventListener("keydown", d); removeEventListener("keyup", u);
      removeEventListener("mousemove", move); el.removeEventListener("mousedown", shoot);
      el.removeEventListener("mousedown", aimOn); removeEventListener("mouseup", aimOff);
      el.removeEventListener("contextmenu", noCtx);
    };
  }, [camera, scene, ray, gl, onHit, onAim, playing]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const k = keys.current;
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, "YXZ");

    const cam = camera as THREE.PerspectiveCamera;
    const targetFov = aiming.current ? SCOPE_FOV : 75;
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-14 * dt));
      cam.updateProjectionMatrix();
    }

    const fwd = new THREE.Vector3(-Math.sin(look.current.yaw), 0, -Math.cos(look.current.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (playing) {
      if (k.KeyW) move.add(fwd);
      if (k.KeyS) move.sub(fwd);
      if (k.KeyD) move.add(right);
      if (k.KeyA) move.sub(right);
    }
    const grounded = camera.position.y <= EYE + 0.001;
    if (playing && k.Space && grounded) vy.current = JUMP_V;
    vy.current -= GRAVITY * dt;
    camera.position.y += vy.current * dt;
    if (camera.position.y < EYE) { camera.position.y = EYE; vy.current = 0; }

    if (move.lengthSq()) {
      move.normalize().multiplyScalar(SPEED * dt * (k.ShiftLeft ? 1.6 : 1));
      const feet = camera.position.y - EYE;
      const blockedAt = (x: number, z: number) =>
        CRATES.some((c) => feet < c.s - 0.1 && Math.abs(x - c.x) < c.s / 2 + 0.4 && Math.abs(z - c.z) < c.s / 2 + 0.4);
      const nx = camera.position.x + move.x, nz = camera.position.z + move.z;
      if (!blockedAt(nx, camera.position.z)) camera.position.x = nx;
      if (!blockedAt(camera.position.x, nz)) camera.position.z = nz;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA, ARENA);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA, ARENA);
    }
    // Land on top of crates
    const under = CRATES.find((c) => Math.abs(camera.position.x - c.x) < c.s / 2 + 0.3 && Math.abs(camera.position.z - c.z) < c.s / 2 + 0.3);
    if (under && vy.current <= 0 && camera.position.y - EYE <= under.s && camera.position.y - EYE > under.s - 0.5) {
      camera.position.y = EYE + under.s; vy.current = 0;
    }
    if (under && camera.position.y === EYE + under.s && playing && k.Space) vy.current = JUMP_V;

    recoil.current *= Math.exp(-12 * dt);
    const bob = move.lengthSq() && grounded ? Math.sin(state.clock.elapsedTime * 12) * 0.015 : 0;
    if (gun.current) {
      gun.current.visible = !aiming.current;
      gun.current.position.copy(camera.position);
      gun.current.quaternion.copy(camera.quaternion);
      gun.current.translateX(0.25);
      gun.current.translateY(-0.22 + bob);
      gun.current.translateZ(-0.5 + recoil.current * 0.1);
      gun.current.rotateX(recoil.current * 0.2);
    }
    if (flash.current) flash.current.intensity = recoil.current > 0.7 ? 8 : 0;

    bullets.current = bullets.current.filter((b) => {
      const step = Math.min(BULLET_SPEED * dt, b.left);
      b.mesh.position.addScaledVector(b.dir, step);
      b.left -= step;
      if (b.left <= 0) { fx.current?.remove(b.mesh); return false; }
      return true;
    });
    sparks.current = sparks.current.filter((s) => {
      if (s.mesh.userData.delay > 0) { s.mesh.userData.delay -= dt; return true; }
      s.mesh.visible = true;
      s.life -= dt;
      s.mesh.scale.setScalar(1 + (0.35 - s.life) * 8);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(s.life / 0.35, 0);
      if (s.life <= 0) { fx.current?.remove(s.mesh); return false; }
      return true;
    });
  });

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ solid: true }}>
        <planeGeometry args={[ARENA * 2.5, ARENA * 2.5]} />
        <meshStandardMaterial map={sand} roughness={1} />
      </mesh>
      {CRATES.map((c, i) => (
        <mesh key={i} position={[c.x, c.s / 2, c.z]} castShadow receiveShadow userData={{ solid: true }}>
          <boxGeometry args={[c.s, c.s, c.s]} />
          <meshStandardMaterial map={crate} />
        </mesh>
      ))}
      {[[0, -ARENA - 1, 0], [0, ARENA + 1, 0], [-ARENA - 1, 0, 1], [ARENA + 1, 0, 1]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 2, z]} rotation-y={r ? Math.PI / 2 : 0} userData={{ solid: true }} receiveShadow>
          <boxGeometry args={[ARENA * 2 + 2, 4, 1]} />
          <meshStandardMaterial color="#a0704a" roughness={0.9} />
        </mesh>
      ))}
      {BARRELS.map((b, i) => (
        <mesh key={"b" + i} position={[b[0], 0.6, b[1]]} castShadow receiveShadow userData={{ solid: true }}>
          <cylinderGeometry args={[0.45, 0.45, 1.2, 16]} />
          <meshStandardMaterial color={i % 2 ? "#5d6b4a" : "#7a3b2a"} metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {targets.map((t) => <TargetMesh key={t.id} t={t} onRespawn={(rid) => setTargets((ts) => ts.map((x) => (x.id === rid ? randTarget(nextId.current++) : x)))} />)}
      <group ref={fx} />
      <group ref={gun}>
        <mesh>
          <boxGeometry args={[0.07, 0.1, 0.45]} />
          <meshStandardMaterial color="#3a3d40" metalness={0.7} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, -0.3]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.1, 0.12]} rotation-x={0.3}>
          <boxGeometry args={[0.06, 0.16, 0.08]} />
          <meshStandardMaterial color="#4a3020" />
        </mesh>
        <object3D ref={muzzle} position={[0, 0, -0.42]} />
        <pointLight ref={flash} position={[0, 0, -0.45]} color="#ffb347" distance={6} intensity={0} />
      </group>
    </>
  );
}

const skin = new THREE.MeshStandardMaterial({ color: "#c8a77a", roughness: 0.85 });
const cloth = new THREE.MeshStandardMaterial({ color: "#6b6f4a", roughness: 0.95 });
const strap = new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 0.7 });
const bullseye = new THREE.MeshStandardMaterial({ color: "#a8322a", roughness: 0.8 });

function Part({ id, geo, mat, ...rest }: { id: number | undefined; geo: THREE.BufferGeometry; mat: THREE.Material } & Record<string, unknown>) {
  return <mesh geometry={geo} material={mat} castShadow receiveShadow userData={id === undefined ? {} : { targetId: id }} {...rest} />;
}
const G = {
  torso: new THREE.CapsuleGeometry(0.28, 0.55, 6, 12),
  head: new THREE.SphereGeometry(0.2, 16, 16),
  limb: new THREE.CapsuleGeometry(0.08, 0.5, 4, 8),
  leg: new THREE.CapsuleGeometry(0.1, 0.6, 4, 8),
  belt: new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16),
  eye: new THREE.CircleGeometry(0.12, 20),
};

function TargetMesh({ t, onRespawn }: { t: Target; onRespawn: (id: number) => void }) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Group>(null), rLeg = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null), rArm = useRef<THREE.Group>(null);
  const goal = useRef(new THREE.Vector3());
  const fall = useRef(0);
  const speed = useMemo(() => 1.5 + Math.random() * 2, []);
  const pickGoal = () => goal.current.set((Math.random() - 0.5) * ARENA * 1.6, 0, (Math.random() - 0.5) * ARENA * 1.6);
  useEffect(() => { if (ref.current) ref.current.position.set(t.pos.x, 0, t.pos.z); pickGoal(); }, []);
  useFrame((s, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = ref.current; if (!g || !body.current) return;
    if (t.down) {
      fall.current = Math.min(fall.current + dt * 3, 1);
      body.current.rotation.x = -fall.current * (Math.PI / 2) * 0.95;
      body.current.position.y = -fall.current * 0.4;
      if (fall.current >= 1 && !g.userData.timer) g.userData.timer = setTimeout(() => onRespawn(t.id), 1200);
      return;
    }
    const to = goal.current.clone().sub(g.position); to.y = 0;
    if (to.length() < 1) pickGoal();
    to.normalize();
    const next = g.position.clone().addScaledVector(to, speed * dt);
    if (CRATES.some((c) => Math.abs(next.x - c.x) < c.s / 2 + 0.5 && Math.abs(next.z - c.z) < c.s / 2 + 0.5)) pickGoal();
    else g.position.copy(next);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(to.x, to.z), 1 - Math.exp(-6 * dt));
    const w = Math.sin(s.clock.elapsedTime * speed * 4 + t.phase) * 0.6;
    if (lLeg.current) lLeg.current.rotation.x = w;
    if (rLeg.current) rLeg.current.rotation.x = -w;
    if (lArm.current) lArm.current.rotation.x = -w * 0.8;
    if (rArm.current) rArm.current.rotation.x = w * 0.8;
    body.current.position.y = Math.abs(Math.cos(s.clock.elapsedTime * speed * 4 + t.phase)) * 0.05;
  });
  const id = t.down ? undefined : t.id;
  return (
    <group ref={ref}>
      <group ref={body}>
        <Part id={id} geo={G.torso} mat={cloth} position={[0, 1.3, 0]} />
        <Part id={id} geo={G.eye} mat={bullseye} position={[0, 1.4, 0.29]} />
        <Part id={id} geo={G.belt} mat={strap} position={[0, 0.98, 0]} />
        <Part id={id} geo={G.head} mat={skin} position={[0, 1.95, 0]} />
        <group ref={lArm} position={[-0.38, 1.6, 0]}><Part id={id} geo={G.limb} mat={cloth} position={[0, -0.32, 0]} /></group>
        <group ref={rArm} position={[0.38, 1.6, 0]}><Part id={id} geo={G.limb} mat={cloth} position={[0, -0.32, 0]} /></group>
        <group ref={lLeg} position={[-0.14, 0.95, 0]}><Part id={id} geo={G.leg} mat={strap} position={[0, -0.45, 0]} /></group>
        <group ref={rLeg} position={[0.14, 0.95, 0]}><Part id={id} geo={G.leg} mat={strap} position={[0, -0.45, 0]} /></group>
      </group>
    </group>
  );
}

export function Game() {
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(ROUND_TIME);
  const [state, setState] = useState<"menu" | "playing" | "over">("menu");
  const [best, setBest] = useState(0);
  const [hitFx, setHitFx] = useState(0);
  const [aiming, setAiming] = useState(false);

  useEffect(() => setBest(Number(localStorage.getItem("fps-best") || 0)), []);
  useEffect(() => {
    if (state !== "playing") return;
    const i = setInterval(() => setTime((t) => {
      if (t <= 1) { setState("over"); document.exitPointerLock(); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(i);
  }, [state]);
  useEffect(() => {
    if (state === "over" && score > best) { setBest(score); localStorage.setItem("fps-best", String(score)); }
  }, [state, score, best]);

  const onHit = useMemo(() => () => { setScore((s) => s + 1); setHitFx((h) => h + 1); }, []);
  const start = () => { setScore(0); setTime(ROUND_TIME); setState("playing"); };

  return (
    <div className="fixed inset-0 bg-background">
      <Canvas shadows gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }} dpr={[1, 2]} camera={{ fov: 75, near: 0.05, position: [0, EYE, 0] }}>
        <color attach="background" args={["#d9c3a0"]} />
        <fog attach="fog" args={["#d9c3a0", 15, 85]} />
        <hemisphereLight args={["#ffe2b8", "#7a5230", 0.6]} />
        <directionalLight position={[25, 35, 12]} intensity={2.6} color="#fff1da" shadow-bias={-0.0005} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} />
        <Environment>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#ffcc99" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <World onHit={onHit} playing={state === "playing"} onAim={setAiming} />
      </Canvas>

      {aiming && state === "playing" && (
        <div className="fps-scope">
          <span className="fps-scope-line-h" />
          <span className="fps-scope-line-v" />
          <span className="fps-scope-dot" />
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 z-10 font-mono text-foreground">
        <div className="flex justify-between p-5 text-2xl font-bold fps-hud">
          <span>SCORE {score}</span>
          <span>⏱ {time}s</span>
        </div>
        {state === "playing" && !aiming && <div key={hitFx} className={`fps-crosshair ${hitFx ? "fps-hit" : ""}`} />}
        {state !== "playing" && (
          <div className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 text-center">
            <h1 className="fps-title text-6xl">DUST RANGE</h1>
            {state === "over" && <p className="text-3xl">You dropped {score} dummies!</p>}
            <p className="text-lg">Best: {Math.max(best, state === "over" ? score : 0)}</p>
            <p className="max-w-md text-muted-foreground">WASD move · Space jump · Shift sprint · Mouse aim · Click shoot · Hold right-click to aim down the scope. Take down as many moving dummies as you can in {ROUND_TIME}s.</p>
            <button onClick={start} className="rounded-md bg-primary px-8 py-3 text-xl font-bold text-primary-foreground">
              {state === "over" ? "PLAY AGAIN" : "START"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
