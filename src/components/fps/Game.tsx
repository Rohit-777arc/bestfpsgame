import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PointerLockControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const SPEED = 9;
const ARENA = 40;
const ROUND_TIME = 60;

type Target = { id: number; pos: THREE.Vector3; phase: number };

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

function World({ onHit, playing }: { onHit: () => void; playing: boolean }) {
  const { camera, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const [targets, setTargets] = useState<Target[]>(() => Array.from({ length: 8 }, (_, i) => randTarget(i)));
  const nextId = useRef(100);
  const gun = useRef<THREE.Group>(null);
  const recoil = useRef(0);
  const flash = useRef<THREE.PointLight>(null);
  const sand = useMemo(sandTexture, []);
  const crate = useMemo(crateTexture, []);
  const ray = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    camera.position.set(0, 1.7, 0);
    const d = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const shoot = () => {
      if (!playing || !document.pointerLockElement) return;
      recoil.current = 1;
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hits = ray.intersectObjects(scene.children, true);
      const hit = hits.find((h) => h.object.userData.targetId !== undefined || h.object.userData.solid);
      if (hit && hit.object.userData.targetId !== undefined) {
        const id = hit.object.userData.targetId;
        setTargets((ts) => ts.map((t) => (t.id === id ? randTarget(nextId.current++) : t)));
        onHit();
      }
    };
    addEventListener("keydown", d);
    addEventListener("keyup", u);
    addEventListener("mousedown", shoot);
    return () => { removeEventListener("keydown", d); removeEventListener("keyup", u); removeEventListener("mousedown", shoot); };
  }, [camera, scene, ray, onHit, playing]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const k = keys.current;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3();
    if (k.KeyW) move.add(fwd);
    if (k.KeyS) move.sub(fwd);
    if (k.KeyD) move.add(right);
    if (k.KeyA) move.sub(right);
    if (playing && move.lengthSq()) {
      move.normalize().multiplyScalar(SPEED * dt * (k.ShiftLeft ? 1.6 : 1));
      const next = camera.position.clone().add(move);
      const blocked = CRATES.some((c) => Math.abs(next.x - c.x) < c.s / 2 + 0.4 && Math.abs(next.z - c.z) < c.s / 2 + 0.4);
      if (!blocked) camera.position.copy(next);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA, ARENA);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA, ARENA);
      camera.position.y = 1.7 + Math.sin(state.clock.elapsedTime * 12) * 0.04;
    }
    recoil.current *= Math.exp(-12 * dt);
    if (gun.current) {
      gun.current.position.copy(camera.position);
      gun.current.quaternion.copy(camera.quaternion);
      gun.current.translateX(0.3);
      gun.current.translateY(-0.28);
      gun.current.translateZ(-0.6 + recoil.current * 0.12);
      gun.current.rotateX(recoil.current * 0.25);
    }
    if (flash.current) flash.current.intensity = recoil.current > 0.7 ? 8 : 0;
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
      <group ref={gun}>
        <mesh>
          <boxGeometry args={[0.1, 0.14, 0.6]} />
          <meshStandardMaterial color="#2b2b2b" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.12, 0.15]} rotation-x={0.3}>
          <boxGeometry args={[0.08, 0.2, 0.1]} />
          <meshStandardMaterial color="#4a3020" />
        </mesh>
        <pointLight ref={flash} position={[0, 0, -0.4]} color="#ffb347" distance={6} intensity={0} />
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
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 75, position: [0, 1.7, 0] }}>
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
        {state === "playing" && <PointerLockControls />}
      </Canvas>

      <div className="pointer-events-none fixed inset-0 z-10 font-mono text-foreground">
        <div className="flex justify-between p-5 text-2xl font-bold drop-shadow">
          <span>SCORE {score}</span>
          <span>⏱ {time}s</span>
        </div>
        {state === "playing" && (
          <div key={hitFx} className={`fps-crosshair ${hitFx ? "fps-hit" : ""}`} />
        )}
        {state !== "playing" && (
          <div className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 text-center">
            <h1 className="fps-title text-6xl">DUST RANGE</h1>
            {state === "over" && <p className="text-3xl">You hit {score} targets!</p>}
            <p className="text-lg">Best: {Math.max(best, state === "over" ? score : 0)}</p>
            <p className="max-w-md text-muted-foreground">WASD to move · Shift to sprint · Mouse to aim · Click to shoot. Hit as many targets as you can in {ROUND_TIME}s.</p>
            <button onClick={start} className="rounded-md bg-primary px-8 py-3 text-xl font-bold text-primary-foreground">
              {state === "over" ? "PLAY AGAIN" : "START"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
