import { createFileRoute } from "@tanstack/react-router";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TopBar } from "@/components/game/TopBar";
import { GameChat, type GameChatMessage } from "@/components/game/GameChat";

export const Route = createFileRoute("/racing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "3D Car Racing — Mexican Standof" },
      { name: "description", content: "Drive a 3D car, steer through traffic, boost, and collect coins." },
    ],
  }),
  component: RacingPage,
});

type RaceHud = {
  speedRef: MutableRefObject<number>;
  nitroRef: MutableRefObject<number>;
  steeringRef: MutableRefObject<number>;
  onTitle: (title: string) => void;
  onScore: (amount: number) => void;
};

function RoadCar({
  position,
  color = "#d83d36",
}: {
  position: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[1.55, 0.42, 3.1]} />
        <meshStandardMaterial color={color} metalness={0.32} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.78, -0.18]} castShadow>
        <boxGeometry args={[1.28, 0.48, 1.55]} />
        <meshStandardMaterial color="#172838" metalness={0.55} roughness={0.2} />
      </mesh>
      {[-0.82, 0.82].map((x) =>
        [-1.05, 1.05].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.28, z]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.22, 18]} />
            <meshStandardMaterial color="#090b0c" roughness={0.92} />
          </mesh>
        )),
      )}
      <mesh position={[-0.48, 0.63, -1.56]}>
        <boxGeometry args={[0.32, 0.12, 0.08]} />
        <meshStandardMaterial color="#fff1ae" emissive="#ffd45a" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.48, 0.63, -1.56]}>
        <boxGeometry args={[0.32, 0.12, 0.08]} />
        <meshStandardMaterial color="#fff1ae" emissive="#ffd45a" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

function RaceScene(props: RaceHud) {
  const car = useRef<THREE.Group>(null);
  const rivals = useRef<(THREE.Group | null)[]>([null, null, null]);
  const rivalStates = useRef([
    { x: -3.2, z: 16, y: 0, vy: 0, collided: false },
    { x: 3.2, z: 24, y: 0, vy: 0, collided: false },
    { x: 0, z: 34, y: 0, vy: 0, collided: false },
  ]);
  const pickups = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const pickupStates = useRef([
    { x: -2.6, z: 20, kind: "nitro", active: true },
    { x: 2.7, z: 31, kind: "coin", active: true },
    { x: 0, z: 43, kind: "coin", active: true },
    { x: -3.1, z: 55, kind: "coin", active: true },
  ]);
  const roadside = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const stripes = useRef<(THREE.Mesh | null)[]>([]);
  const roadTime = useRef(0);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    roadTime.current += delta;
    const speed = props.speedRef.current;
    const forward = speed * delta * 0.035;

    if (car.current) {
      car.current.position.x = THREE.MathUtils.clamp(
        car.current.position.x + props.steeringRef.current * delta * (1.4 + speed / 130),
        -4.15,
        4.15,
      );
      car.current.rotation.z = THREE.MathUtils.lerp(
        car.current.rotation.z,
        -props.steeringRef.current * 0.12,
        0.12,
      );
      car.current.position.y = 0.04 + Math.sin(roadTime.current * 8) * Math.min(0.025, speed / 9000);
    }

    stripes.current.forEach((stripe, i) => {
      if (!stripe) return;
      stripe.position.z += forward;
      if (stripe.position.z > 12) stripe.position.z -= 72;
    });

    rivalStates.current.forEach((rival, i) => {
      const group = rivals.current[i];
      if (!group) return;
      if (rival.collided) {
        rival.vy -= 12 * delta;
        rival.y += rival.vy * delta;
        rival.x += (i % 2 ? 5 : -5) * delta;
        if (rival.y < 0) {
          rival.y = 0;
          rival.vy = 0;
        }
        group.position.set(rival.x, rival.y, rival.z);
        rival.z += speed * delta * 0.018;
      } else {
        rival.z -= (4.5 + speed * 0.018) * delta;
        if (rival.z < -8) {
          rival.z = 52 + i * 12;
          rival.x = [-3.1, 3.1, 0][i];
        }
        rival.x += Math.sin(roadTime.current * 0.7 + i) * delta * 0.35;
        group.position.set(rival.x, 0.04, rival.z);
      }

      if (
        car.current &&
        !rival.collided &&
        Math.abs(rival.z - car.current.position.z) < 1.25 &&
        Math.abs(rival.x - car.current.position.x) < 1.35
      ) {
        rival.collided = true;
        rival.vy = speed > 110 ? 8 : 4;
        props.onTitle(speed > 110 ? "WRECKED" : "SIDE-SWIPE");
      }
    });

    pickupStates.current.forEach((pickup, i) => {
      const group = pickups.current[i];
      if (!group) return;
      if (!pickup.active) {
        pickup.z += 0.5 * delta;
        if (pickup.z > 58) {
          pickup.z = 48;
          pickup.active = true;
        }
      } else {
        pickup.z -= (3.5 + speed * 0.018) * delta;
        if (pickup.z < -8) pickup.z = 55 + i * 7;
      }
      group.visible = pickup.active;
      group.rotation.y += delta * 1.8;
      group.position.set(pickup.x, 0.7 + Math.sin(roadTime.current * 3 + i) * 0.12, pickup.z);
      if (
        pickup.active &&
        car.current &&
        Math.abs(pickup.z - car.current.position.z) < 1.1 &&
        Math.abs(pickup.x - car.current.position.x) < 1.25
      ) {
        pickup.active = false;
        if (pickup.kind === "nitro") {
          props.nitroRef.current = Math.min(100, props.nitroRef.current + 34);
          props.onTitle("NITRO +34");
        } else {
          props.onScore(100);
          props.onTitle("COINS +100");
        }
      }
    });

    roadside.current.forEach((object, i) => {
      if (!object) return;
      object.position.z += forward;
      if (object.position.z > 12) object.position.z -= 62;
      if (
        car.current &&
        Math.abs(object.position.z - car.current.position.z) < 1 &&
        Math.abs(Math.abs(object.position.x) - Math.abs(car.current.position.x)) < 0.9
      ) {
        props.onTitle("ROAD EDGE");
        object.position.z -= 8;
      }
    });
  });

  const roadStripes = Array.from({ length: 24 }, (_, i) => -66 + i * 3.2);
  return (
    <>
      <color attach="background" args={["#7ba8b4"]} />
      <fog attach="fog" args={["#7ba8b4", 28, 82]} />
      <hemisphereLight intensity={1.7} color="#eaf7ff" groundColor="#40503e" />
      <directionalLight position={[12, 18, 8]} intensity={3.2} castShadow />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[12, 150]} />
        <meshStandardMaterial color="#3e4145" roughness={0.78} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[32, 150]} />
        <meshStandardMaterial color="#6e8e58" roughness={0.9} />
      </mesh>
      {[-5.95, 5.95].map((x) => (
        <mesh key={x} position={[x, 0.01, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.15, 150]} />
          <meshStandardMaterial color="#f2f0d4" />
        </mesh>
      ))}
      {roadStripes.map((z, i) => (
        <mesh
          key={z}
          ref={(node) => { stripes.current[i] = node; }}
          position={[0, 0.012, z]}
          rotation-x={-Math.PI / 2}
        >
          <planeGeometry args={[0.12, 2]} />
          <meshStandardMaterial color="#f1d967" />
        </mesh>
      ))}
      {[
        { x: -6.6, z: 8 },
        { x: 6.6, z: 22 },
        { x: -6.6, z: 36 },
        { x: 6.6, z: 50 },
      ].map((object, i) => (
        <group
          key={i}
          ref={(node) => { roadside.current[i] = node; }}
          position={[object.x, 0, object.z]}
        >
          {i % 2 === 0 ? (
            <>
              <mesh position={[0, 2.1, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.12, 4.2, 12]} />
                <meshStandardMaterial color="#8b9498" metalness={0.65} />
              </mesh>
              <mesh position={[0, 4.25, 0]} castShadow>
                <boxGeometry args={[1.15, 0.16, 0.16]} />
                <meshStandardMaterial color="#c98a32" emissive="#ffce69" emissiveIntensity={0.3} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.75, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 1.5, 16]} />
              <meshStandardMaterial color="#c72d25" metalness={0.25} />
            </mesh>
          )}
        </group>
      ))}
      {rivalStates.current.map((rival, i) => (
        <group
          key={i}
          ref={(node) => { rivals.current[i] = node; }}
          position={[rival.x, rival.y, rival.z]}
        >
          <RoadCar position={[0, 0, 0]} color={["#4d79c9", "#f3b84a", "#55a875"][i]} />
        </group>
      ))}
      {pickupStates.current.map((pickup, i) => (
        <group
          key={i}
          ref={(node) => { pickups.current[i] = node; }}
          position={[pickup.x, 0.7, pickup.z]}
        >
          {pickup.kind === "nitro" ? (
            <>
              <mesh rotation-z={0.25}>
                <cylinderGeometry args={[0.24, 0.24, 0.8, 16]} />
                <meshStandardMaterial color="#27bbd6" emissive="#20d8f4" emissiveIntensity={0.8} />
              </mesh>
              <mesh position={[0, 0.46, 0]} castShadow>
                <boxGeometry args={[0.32, 0.12, 0.32]} />
                <meshStandardMaterial color="#1c2b31" />
              </mesh>
            </>
          ) : (
            <mesh>
              <boxGeometry args={[0.72, 0.42, 0.72]} />
              <meshStandardMaterial color="#ff9d24" emissive="#ff5522" emissiveIntensity={0.6} />
            </mesh>
          )}
        </group>
      ))}
      <group ref={car} position={[0, 0.04, 4]}>
        <RoadCar position={[0, 0, 0]} />
      </group>
      <mesh position={[0, 0.1, -30]} castShadow>
        <boxGeometry args={[11, 0.2, 1]} />
        <meshStandardMaterial color="#e5e0c7" />
      </mesh>
      <mesh position={[0, 4.2, -42]} rotation-y={0}>
        <boxGeometry args={[11, 0.25, 0.25]} />
        <meshStandardMaterial color="#de3e34" />
      </mesh>
      {[-5, 5].map((x) => (
        <mesh key={x} position={[x, 2, -42]} castShadow>
          <boxGeometry args={[0.18, 4, 0.18]} />
          <meshStandardMaterial color="#dcd8ca" />
        </mesh>
      ))}
    </>
  );
}

function RacingPage() {
  const [speed, setSpeed] = useState(0);
  const [nitro, setNitro] = useState(100);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [title, setTitle] = useState("RACING READY");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([]);
  const keys = useRef<Record<string, boolean>>({});
  const speedRef = useRef(0);
  const nitroRef = useRef(100);
  const steeringRef = useRef(0);
  const driftChain = useRef(0);
  const distanceRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      keys.current[event.code] = true;
      if (event.code === "KeyT") setChatOpen((open) => !open);
    };
    const up = (event: KeyboardEvent) => { keys.current[event.code] = false; };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const left = keys.current.KeyA || keys.current.ArrowLeft;
      const right = keys.current.KeyD || keys.current.ArrowRight;
      steeringRef.current = left ? -1 : right ? 1 : 0;
      const boosting = (keys.current.ShiftLeft || keys.current.ShiftRight) && nitroRef.current > 0;
      const target = keys.current.KeyW || keys.current.ArrowUp
        ? (boosting ? 230 : 150)
        : (keys.current.KeyS || keys.current.ArrowDown ? 35 : 0);
      const next = THREE.MathUtils.lerp(speedRef.current, target, dt * (target > speedRef.current ? 1.5 : 2.2));
      speedRef.current = Math.max(0, Math.min(230, next));
      distanceRef.current += (speedRef.current / 3.6) * dt;
      if (boosting) {
        nitroRef.current = Math.max(0, nitroRef.current - 24 * dt);
        setNitro(nitroRef.current);
      } else {
        nitroRef.current = Math.min(100, nitroRef.current + 3.5 * dt);
        setNitro(nitroRef.current);
      }
      if (steeringRef.current !== 0 && speedRef.current > 70) {
        driftChain.current += dt;
        if (driftChain.current > 0.65) setTitle(`DRIFT x${Math.min(5, Math.floor(driftChain.current + 1))}`);
      } else {
        driftChain.current = 0;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSpeed(speedRef.current);
      setNitro(nitroRef.current);
      setDistance(distanceRef.current);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <TopBar />
      <main className="racing-3d-shell">
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{ position: [0, 5.2, 10.5], fov: 48 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <RaceScene
            speedRef={speedRef}
            nitroRef={nitroRef}
            steeringRef={steeringRef}
            onTitle={setTitle}
            onScore={(amount) => setScore((value) => value + amount)}
          />
        </Canvas>
        <div className="racing-title" key={title}>{title}</div>
        <div className="racing-hud">
          <div><span>SPEED</span><strong>{Math.round(speed)} KM/H</strong></div>
          <div><span>NITRO</span><strong>{Math.round(nitro)}%</strong></div>
          <div><span>DISTANCE</span><strong>{Math.floor(distance)} M</strong></div>
          <div><span>COINS</span><strong>{score}</strong></div>
        </div>
        <div className="racing-controls">
          <span>W/S</span> ACCELERATE/BRAKE · <span>A/D</span> STEER · <span>SHIFT</span> NITRO · COLLECT THE GLOWING ORBS
        </div>
        <GameChat
          open={chatOpen}
          messages={chatMessages}
          onSend={(text) => {
            setChatMessages((messages) => [
              ...messages.slice(-7),
              { id: `${Date.now()}-${Math.random()}`, name: "YOU", text },
            ]);
            setChatOpen(false);
          }}
          onClose={() => setChatOpen(false)}
        />
      </main>
    </>
  );
}
