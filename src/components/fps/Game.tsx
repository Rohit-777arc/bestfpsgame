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

type Target = { id: number; pos: THREE.Vector3; phase: number };
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

function World({ onHit, playing }: { onHit: () => void; playing: boolean }) {
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
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true; if (e.code === "Space") e.preventDefault(); };
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      look.current.yaw -= e.movementX * SENS;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * SENS, -1.5, 1.5);
    };
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
          setTargets((ts) => ts.map((t) => (t.id === id ? randTarget(nextId.current++) : t)));
          onHit();
        }, (dist / BULLET_SPEED) * 1000);
      }
    };
    addEventListener("keydown", d);
    addEventListener("keyup", u);
    addEventListener("mousemove", move);
    el.addEventListener("mousedown", shoot);
    return () => {
      removeEventListener("keydown", d); removeEventListener("keyup", u);
      removeEventListener("mousemove", move); el.removeEventListener("mousedown", shoot);
    };
  }, [camera, scene, ray, gl, onHit, playing]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const k = keys.current;
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, "YXZ");

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
      {targets.map((t) => <TargetMesh key={t.id} t={t} />)}
      <group ref={fx} />
      <group ref={gun}>
        <mesh>
          <boxGeometry args={[0.07, 0.1, 0.45]} />
          <meshStandardMaterial color="#2b2b2b" metalness={0.8} roughness={0.3} />
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

function TargetMesh({ t }: { t: Target }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.position.set(t.pos.x + Math.sin(s.clock.elapsedTime + t.phase) * 2, t.pos.y + Math.sin(s.clock.elapsedTime * 2 + t.phase) * 0.4, t.pos.z);
    ref.current.lookAt(s.camera.position);
  });
  return (
    <group ref={ref}>
      {[0.8, 0.55, 0.3].map((r, i) => (
        <mesh key={i} position-z={i * 0.02} userData={{ targetId: t.id }} castShadow>
          <circleGeometry args={[r, 32]} />
          <meshStandardMaterial color={i % 2 ? "#f4efe6" : "#c0392b"} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function Game() {
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(ROUND_TIME);
  const [state, setState] = useState<"menu" | "playing" | "over">("menu");
  const [best, setBest] = useState(0);
  const [hitFx, setHitFx] = useState(0);

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
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 75, near: 0.05, position: [0, EYE, 0] }}>
        <color attach="background" args={["#e8b07a"]} />
        <fog attach="fog" args={["#e8b07a", 20, 75]} />
        <hemisphereLight args={["#ffe2b8", "#7a5230", 0.6]} />
        <directionalLight position={[20, 30, 10]} intensity={2} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} />
        <Environment>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#ffcc99" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <World onHit={onHit} playing={state === "playing"} />
      </Canvas>

      <div className="pointer-events-none fixed inset-0 z-10 font-mono text-foreground">
        <div className="flex justify-between p-5 text-2xl font-bold fps-hud">
          <span>SCORE {score}</span>
          <span>⏱ {time}s</span>
        </div>
        {state === "playing" && <div key={hitFx} className={`fps-crosshair ${hitFx ? "fps-hit" : ""}`} />}
        {state !== "playing" && (
          <div className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 text-center">
            <h1 className="fps-title text-6xl">DUST RANGE</h1>
            {state === "over" && <p className="text-3xl">You hit {score} targets!</p>}
            <p className="text-lg">Best: {Math.max(best, state === "over" ? score : 0)}</p>
            <p className="max-w-md text-muted-foreground">WASD move · Space jump · Shift sprint · Mouse aim · Click shoot. Hit as many targets as you can in {ROUND_TIME}s.</p>
            <button onClick={start} className="rounded-md bg-primary px-8 py-3 text-xl font-bold text-primary-foreground">
              {state === "over" ? "PLAY AGAIN" : "START"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
