import { createFileRoute } from "@tanstack/react-router";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/game/TopBar";
import { createRaceState, raceLap, RACE_LAPS, RACE_TRACK_LENGTH, RAMP_MARKERS, TRACK_RADIUS_Z, stepRace, stepRival, trackPosition, type RaceEvent, type RaceInput, type RaceState } from "@/game/sim/racing";
import mexicanRaceCarModel from "@/assets/models/mexican-race-car.glb.asset.json";
import mexicanRivalSedanModel from "@/assets/models/mexican-rival-sedan.glb.asset.json";
import mexicanRivalHatchbackModel from "@/assets/models/mexican-rival-hatchback.glb.asset.json";

export const Route = createFileRoute("/racing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mexican Standof — Three-Lap 3D Race" },
      { name: "description", content: "Race three laps against rival drivers, drift around the track, and hit ramps for nitro." },
      { property: "og:title", content: "Mexican Standof — Three-Lap 3D Race" },
      { property: "og:description", content: "Race rival cars around a 3D circuit. Drift to build boost and take ramps for nitro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RacingPage,
});

type RivalState = { id: string; distance: number; lane: number; speed: number; model: string; color: string; impactLock: number };
type RaceSceneProps = {
  input: MutableRefObject<RaceInput>;
  stateRef: MutableRefObject<RaceState>;
  onUpdate: (state: ReturnType<typeof createRaceState>, rivals: RivalState[]) => void;
  onEvent: (event: RaceEvent) => void;
  onReady: () => void;
};

const AI_CARS: RivalState[] = [
  { id: "NOVA", distance: 6, lane: -4, speed: 172, model: mexicanRivalSedanModel.url, color: "#c84331", impactLock: 0 },
  { id: "VOLT", distance: 13, lane: 4, speed: 181, model: mexicanRivalHatchbackModel.url, color: "#257bbc", impactLock: 0 },
  { id: "ACE", distance: 20, lane: 0, speed: 165, model: mexicanRaceCarModel.url, color: "#d9a52e", impactLock: 0 },
];

function makeTrackGeometry(outer: number, inner: number, y: number) {
  const segments = 320;
  const positions: number[] = [];
  const indices: number[] = [];
  const radiusX = 63;
  const radiusZ = 50;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push((radiusX + outer) * sin, y, (radiusZ + outer) * cos);
    positions.push((radiusX + inner) * sin, y, (radiusZ + inner) * cos);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeDashedCenterline() {
  const positions: number[] = [];
  const indices: number[] = [];
  const dashCount = 90;
  const halfLength = 0.85;
  for (let i = 0; i < dashCount; i++) {
    const distance = ((i + 0.5) / dashCount) * RACE_TRACK_LENGTH;
    const start = trackPosition(distance - halfLength);
    const end = trackPosition(distance + halfLength);
    const base = positions.length / 3;
    positions.push(start.x - 0.12, 0.035, start.z - 0.12, start.x + 0.12, 0.035, start.z + 0.12);
    positions.push(end.x - 0.12, 0.035, end.z - 0.12, end.x + 0.12, 0.035, end.z + 0.12);
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function RaceCar({ url, color, scale = 1.45 }: { url: string; color: string; scale?: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const tinted = materials.map((material) => {
        const copy = material.clone();
        if (copy instanceof THREE.MeshStandardMaterial) copy.color.set(color);
        return copy;
      });
      mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0] ?? mesh.material;
    });
    return clone;
  }, [color, scene]);
  const wheels = useMemo(() => {
    const found: THREE.Object3D[] = [];
    model.traverse((object) => {
      if (object.name.toLowerCase().includes("wheel")) found.push(object);
    });
    return found;
  }, [model]);
  useFrame((_, delta) => {
    wheels.forEach((wheel) => { wheel.rotation.x += delta * 18; });
  });
  return <primitive object={model} scale={scale} />;
}

function RaceScene({ input, stateRef, onUpdate, onEvent, onReady }: RaceSceneProps) {
  const { camera } = useThree();
  const car = useRef<THREE.Group>(null);
  const rivals = useRef<(THREE.Group | null)[]>([]);
  const state = stateRef;
  const ai = useRef(AI_CARS.map((rival) => ({ ...rival })));
  const road = useMemo(() => makeTrackGeometry(9, -9, 0), []);
  const insideEdge = useMemo(() => makeTrackGeometry(-8.8, -9.5, 0.05), []);
  const outsideEdge = useMemo(() => makeTrackGeometry(8.8, 9.5, 0.05), []);
  const grass = useMemo(() => makeTrackGeometry(44, 9.4, -0.12), []);
  const curbOuter = useMemo(() => makeTrackGeometry(9.3, 8.85, 0.055), []);
  const curbInner = useMemo(() => makeTrackGeometry(-8.85, -9.3, 0.055), []);
  const centerline = useMemo(() => makeDashedCenterline(), []);
  const [ready, setReady] = useState(false);
  const lastEmit = useRef(0);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const current = state.current;
    const collision = ai.current.some((rival) => {
      const playerTrackDistance = current.distance % RACE_TRACK_LENGTH;
      const rivalTrackDistance = rival.distance % RACE_TRACK_LENGTH;
      const gap = Math.abs(rivalTrackDistance - playerTrackDistance);
      const wrappedGap = Math.min(gap, RACE_TRACK_LENGTH - gap);
      return rival.impactLock <= 0 && wrappedGap < 3.5 && Math.abs(rival.lane - current.lateral) < 2.3 && current.speed > 15;
    });
    const events = stepRace(current, input.current, dt, collision);

    ai.current.forEach((rival, index) => {
      rival.distance = stepRival(rival.distance, rival.speed, dt);
      rival.impactLock = Math.max(0, rival.impactLock - dt);
      const progress = (current.distance - rival.distance + RACE_TRACK_LENGTH * RACE_LAPS) % (RACE_TRACK_LENGTH * RACE_LAPS);
      if (progress < 3.2 && Math.abs(rival.lane - current.lateral) < 2.3 && current.speed > 15 && rival.impactLock <= 0) {
        rival.speed *= 0.84;
        rival.lane = THREE.MathUtils.clamp(rival.lane + (index % 2 === 0 ? -2.7 : 2.7), -6, 6);
        rival.impactLock = 1.2;
        onEvent("wrecked");
      }
      const desired = Math.min(220, Math.max(142, current.speed + (index - 1) * 13));
      rival.speed = THREE.MathUtils.damp(rival.speed, desired, 0.18, dt);
      const path = trackPosition(rival.distance, rival.lane);
      const group = rivals.current[index];
      if (group) {
        group.position.set(path.x, 0.035, path.z);
        group.rotation.y = path.yaw;
      }
    });

    const playerPath = trackPosition(current.distance, current.lateral);
    if (car.current) {
      car.current.position.set(playerPath.x, 0.06 + (current.jumpTime > 0 ? Math.sin((0.9 - current.jumpTime) / 0.9 * Math.PI) * 1.8 : 0), playerPath.z);
      car.current.rotation.y = playerPath.yaw;
      car.current.rotation.z = THREE.MathUtils.damp(car.current.rotation.z, -input.current.steering * 0.08 - current.lateralSpeed * 0.012, 4, dt);
    }

    if (car.current) {
      const behind = new THREE.Vector3(0, 5.5, 12).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerPath.yaw);
      const cameraTarget = new THREE.Vector3(playerPath.x, 0, playerPath.z);
      camera.position.lerp(cameraTarget.clone().add(behind), 1 - Math.exp(-2.6 * dt));
      camera.lookAt(cameraTarget.x, cameraTarget.y + 1, cameraTarget.z);
    }

    if (events.length) events.forEach(onEvent);
    if (!ready && car.current) {
      setReady(true);
      onReady();
    }
    if (lastEmit.current > 0.09) {
      lastEmit.current = 0;
      onUpdate(current, ai.current);
    } else lastEmit.current += dt;
  });

  return (
    <>
      <color attach="background" args={["#91bdcc"]} />
      <fog attach="fog" args={["#91bdcc", 100, 250]} />
      <hemisphereLight intensity={1.6} color="#eaf7ff" groundColor="#526241" />
      <directionalLight position={[25, 40, 10]} intensity={3.2} castShadow shadow-mapSize={[2048, 2048]} />
      <mesh geometry={grass} receiveShadow>
        <meshStandardMaterial color="#658c47" roughness={0.92} />
      </mesh>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial color="#33383b" roughness={0.82} />
      </mesh>
      <mesh geometry={insideEdge}>
        <meshStandardMaterial color="#e3e0d4" roughness={0.78} />
      </mesh>
      <mesh geometry={outsideEdge}>
        <meshStandardMaterial color="#e3e0d4" roughness={0.78} />
      </mesh>
      <mesh geometry={curbOuter}>
        <meshStandardMaterial color="#d54833" roughness={0.72} />
      </mesh>
      <mesh geometry={curbInner}>
        <meshStandardMaterial color="#f2e8d7" roughness={0.72} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.14, 0]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#658c47" roughness={0.92} />
      </mesh>
      <mesh geometry={centerline}>
        <meshStandardMaterial color="#ede4d1" roughness={0.82} />
      </mesh>
      {Array.from({ length: 64 }, (_, index) => {
        const distance = (index / 64) * RACE_TRACK_LENGTH;
        const path = trackPosition(distance, index % 2 === 0 ? 15 : -15);
        const isTree = index % 5 === 0;
        return (
          <group key={index} position={[path.x, 0, path.z]}>
            {isTree ? (
              <>
                <mesh position={[0, 2, 0]} castShadow><cylinderGeometry args={[0.35, 0.55, 4, 8]} /><meshStandardMaterial color="#644a31" roughness={0.9} /></mesh>
                <mesh position={[0, 5, 0]} castShadow><coneGeometry args={[2.5, 6, 8]} /><meshStandardMaterial color={index % 10 ? "#396248" : "#527840"} roughness={0.9} /></mesh>
              </>
            ) : (
              <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[0.75, 1.1, 0.75]} /><meshStandardMaterial color={index % 2 ? "#f3eee4" : "#d84a35"} roughness={0.82} /></mesh>
            )}
          </group>
        );
      })}
      {RAMP_MARKERS.map((marker, index) => {
        const path = trackPosition(marker, 0);
        return (
          <group key={marker} position={[path.x, 0.1, path.z]} rotation-y={path.yaw}>
            <mesh position={[0, 0.24, 0]} rotation-x={-0.13} castShadow receiveShadow><boxGeometry args={[5.6, 0.42, 9]} /><meshStandardMaterial color="#e0a62d" metalness={0.45} roughness={0.36} emissive="#a65b0d" emissiveIntensity={0.3} /></mesh>
            <mesh position={[0, 0.53, -3.65]} castShadow><boxGeometry args={[5.6, 0.18, 1.5]} /><meshStandardMaterial color="#62d8ea" emissive="#31c5e0" emissiveIntensity={1.2} /></mesh>
            <mesh position={[0, 0.51, 2.8]}><boxGeometry args={[4.6, 0.05, 0.18]} /><meshStandardMaterial color="#fff2b6" emissive="#fff2b6" emissiveIntensity={0.8} /></mesh>
            {index === 0 && <group position={[0, 0, 0]} />}
          </group>
        );
      })}
      {ai.current.map((rival, index) => (
        <group key={rival.id} ref={(node) => { rivals.current[index] = node; }}>
          <Suspense fallback={null}><RaceCar url={rival.model} color={rival.color} /></Suspense>
        </group>
      ))}
      <group ref={car}>
        <Suspense fallback={null}><RaceCar url={mexicanRaceCarModel.url} color="#f0ad26" scale={1.55} /></Suspense>
        <pointLight position={[0, 0.6, -1.8]} color="#35d9ff" distance={8} intensity={2.2} />
      </group>
      <mesh position={[0, 0.04, TRACK_RADIUS_Z]}>
        <boxGeometry args={[0.6, 0.12, 18]} />
        <meshStandardMaterial color="#f4e9d5" />
      </mesh>
      <mesh position={[0, 0.16, TRACK_RADIUS_Z]}>
        <boxGeometry args={[0.3, 0.1, 0.65]} />
        <meshStandardMaterial color="#c84635" />
      </mesh>
    </>
  );
}

function RacingPage() {
  const sim = useRef(createRaceState());
  const input = useRef<RaceInput>({ throttle: 0, steering: 0, nitro: false, handbrake: false });
  const scoreRef = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const [hud, setHud] = useState({ speed: 0, nitro: 100, lap: 1, drift: 0, driftScore: 0, position: 4, title: "LIGHTS OUT! GO!", finished: false, impact: 0, boost: 0, ready: false });
  const [rivalHud, setRivalHud] = useState<RivalState[]>([]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      keys.current[event.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    };
    const keyUp = (event: KeyboardEvent) => { keys.current[event.code] = false; };
    addEventListener("keydown", keyDown);
    addEventListener("keyup", keyUp);
    return () => {
      removeEventListener("keydown", keyDown);
      removeEventListener("keyup", keyUp);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      input.current = {
        throttle: keys.current.KeyW || keys.current.ArrowUp ? 1 : keys.current.KeyS || keys.current.ArrowDown ? -1 : 0,
        steering: keys.current.KeyA || keys.current.ArrowLeft ? -1 : keys.current.KeyD || keys.current.ArrowRight ? 1 : 0,
        nitro: keys.current.ShiftLeft || keys.current.ShiftRight,
        handbrake: keys.current.Space,
      };
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const updateHud = (state: ReturnType<typeof createRaceState>, rivals: RivalState[]) => {
    sim.current = { ...state };
    const ahead = rivals.filter((rival) => {
      const gap = (rival.distance - state.distance + RACE_TRACK_LENGTH * RACE_LAPS) % (RACE_TRACK_LENGTH * RACE_LAPS);
      return gap > 0 && gap < RACE_TRACK_LENGTH * RACE_LAPS / 2;
    }).length;
    setRivalHud(rivals.map((rival) => ({ ...rival })));
    setHud((old) => ({ ...old, speed: state.speed, nitro: state.nitro, lap: raceLap(state.distance), drift: state.driftMeter, driftScore: state.driftScore, position: Math.min(4, ahead + 1), finished: state.finished, impact: state.impactTime, boost: state.boostTime }));
  };

  const showEvent = (event: RaceEvent) => {
    if (event === "ramp") setHud((old) => ({ ...old, title: "RAMP BOOST + NITRO", boost: Math.max(old.boost, 2.2) }));
    if (event === "drift") setHud((old) => ({ ...old, title: "DRIFT BOOST!" }));
    if (event === "wrecked") setHud((old) => ({ ...old, title: "WRECKED!", impact: 0.85 }));
    if (event === "finished") setHud((old) => ({ ...old, title: "FINISH!", finished: true }));
  };

  const reset = () => {
    sim.current = createRaceState();
    input.current = { throttle: 0, steering: 0, nitro: false, handbrake: false };
    scoreRef.current = 0;
    setHud({ speed: 0, nitro: 100, lap: 1, drift: 0, driftScore: 0, position: 4, title: "LIGHTS OUT! GO!", finished: false, impact: 0, boost: 0, ready: true });
    setRivalHud(AI_CARS.map((rival) => ({ ...rival })));
  };

  return (
    <>
      <TopBar />
      <main className={`racing-3d-shell ${hud.impact > 0 ? "racing-impact" : ""}`} data-scene-ready={hud.ready ? "1" : undefined}>
        <Canvas shadows dpr={[1, 1.6]} camera={{ position: [0, 7, 68], fov: 62 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <RaceScene input={input} scoreRef={scoreRef} onUpdate={updateHud} onEvent={showEvent} onReady={() => setHud((old) => ({ ...old, ready: true }))} />
        </Canvas>
        <header className="race-topline">
          <div className="race-badge"><span>POSITION</span><strong>{hud.position}<small> / 4</small></strong></div>
          <div className="race-lap"><span>LAP</span><strong>{hud.finished ? RACE_LAPS : hud.lap}</strong><i> / {RACE_LAPS}</i></div>
          <div className="race-badge race-speed"><span>SPEED</span><strong>{Math.round(hud.speed)}<small> KM/H</small></strong></div>
        </header>
        <div className={`race-callout ${hud.impact > 0 ? "race-callout-crash" : ""}`} aria-live="polite">{hud.title}</div>
        {rivalHud.map((rival, index) => (
          <div key={rival.id} className="race-nameplate" style={{ left: `${37 + index * 9}%`, top: `${33 + (index % 2) * 6}%` }}>
            <span>{index + 2}</span> {rival.id}
          </div>
        ))}
        <section className="race-meter-stack" aria-label="Race meters">
          <div className="race-meter"><div><span>NITRO</span><strong>{Math.round(hud.nitro)}%</strong></div><div className="race-meter-track race-meter-nitro"><i style={{ width: `${hud.nitro}%` }} /></div><small>SHIFT TO BOOST</small></div>
          <div className="race-meter"><div><span>DRIFT</span><strong>{Math.round(hud.drift)}%</strong></div><div className="race-meter-track race-meter-drift"><i style={{ width: `${hud.drift}%` }} /></div><small>{Math.floor(hud.driftScore)} DRIFT POINTS · SPACE TO SLIDE</small></div>
        </section>
        <div className="race-controls"><kbd>W</kbd> GAS <kbd>S</kbd> BRAKE <kbd>A</kbd><kbd>D</kbd> STEER <kbd>SPACE</kbd> DRIFT <kbd>SHIFT</kbd> NITRO</div>
        {hud.finished && (
          <div className="race-finish">
            <div><span>CHECKERED FLAG</span><h1>RACE COMPLETE</h1><p>Three laps down · Final position {hud.position} / 4 · {Math.floor(hud.driftScore)} drift points</p><Button className="mso-btn" onClick={reset}>RACE AGAIN</Button></div>
          </div>
        )}
      </main>
    </>
  );
}

useGLTF.preload(mexicanRaceCarModel.url);
useGLTF.preload(mexicanRivalSedanModel.url);
useGLTF.preload(mexicanRivalHatchbackModel.url);