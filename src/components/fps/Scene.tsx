// Draws the arena for a map preset: sky, fog, lights, ground, walls, props.
import { useMemo } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { MapDef } from "@/game/sim/maps";
import { ARENA, BARRELS, CRATES, WALLS } from "@/game/sim/arena";
import { groundTexture, crateTexture } from "./textures";

function neonSignTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b0d1a";
  g.fillRect(0, 0, 256, 64);
  g.font = "bold 34px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SIGNS: { text: string; color: string }[] = [
  { text: "MEXICAN STANDOF", color: "#ff3b6b" },
  { text: "TACOS 24H", color: "#3bff8f" },
  { text: "AMMO DEPOT", color: "#ffd23b" },
  { text: "RANK UP", color: "#3bb0ff" },
];

export function Scene({ map }: { map: MapDef }) {
  const sand = useMemo(() => groundTexture(map), [map]);
  const crate = useMemo(() => crateTexture(map), [map]);
  const signTex = useMemo(
    () => (map.neonSigns ? SIGNS.map((s) => neonSignTexture(s.text, s.color)) : null),
    [map],
  );

  return (
    <>
      <color attach="background" args={[map.sky]} />
      <fog attach="fog" args={[map.fog, map.fogNear, map.fogFar]} />
      <hemisphereLight args={[map.hemiSky, map.hemiGround, map.hemiIntensity]} />
      <directionalLight
        position={map.sunPos}
        intensity={map.sunIntensity}
        color={map.sunColor}
        shadow-bias={-0.0005}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
      <Environment>
        <Lightformer intensity={map.night ? 0.6 : 2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={map.night ? 0.4 : 1} color={map.envFill} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>

      <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ solid: true }}>
        <planeGeometry args={[ARENA * 2.5, ARENA * 2.5]} />
        <meshStandardMaterial map={sand} roughness={1} />
      </mesh>

      {CRATES.map((c, i) => (
        <mesh key={i} position={[c.x, c.s / 2, c.z]} castShadow receiveShadow userData={{ solid: true }}>
          <boxGeometry args={[c.s, c.s, c.s]} />
          <meshStandardMaterial map={crate} roughness={map.night ? 0.7 : 0.9} />
        </mesh>
      ))}

      {WALLS.map((w, i) => (
        <mesh key={i} position={[w.x, 2, w.z]} rotation-y={w.ry} userData={{ solid: true }} receiveShadow>
          <boxGeometry args={[ARENA * 2 + 2, 4, 1]} />
          <meshStandardMaterial color={map.wallColor} roughness={0.9} />
        </mesh>
      ))}

      {BARRELS.map((b, i) => (
        <mesh key={"b" + i} position={[b[0], 0.6, b[1]]} castShadow receiveShadow userData={{ solid: true }}>
          <cylinderGeometry args={[0.45, 0.45, 1.2, 16]} />
          <meshStandardMaterial
            color={map.barrelColors[i % 2]}
            metalness={map.night ? 0.7 : 0.5}
            roughness={0.6}
          />
        </mesh>
      ))}

      {signTex &&
        SIGNS.map((s, i) => (
          <mesh
            key={"s" + i}
            position={[i % 2 === 0 ? -ARENA + 6 + i * 12 : ARENA - 6 - i * 12, 3, (i < 2 ? -1 : 1) * (ARENA - 0.6)]}
            rotation-y={i < 2 ? 0 : Math.PI}
          >
            <planeGeometry args={[6, 1.5]} />
            <meshBasicMaterial map={signTex[i]} toneMapped={false} />
          </mesh>
        ))}

      {map.night &&
        CRATES.slice(0, 6).map((c, i) => (
          <pointLight key={"pl" + i} position={[c.x, c.s + 1.2, c.z]} color={SIGNS[i % 4].color} intensity={6} distance={9} />
        ))}
    </>
  );
}

const undergroundWall = new THREE.MeshStandardMaterial({ color: "#77735b", roughness: 0.98 });
const undergroundStone = new THREE.MeshStandardMaterial({ color: "#4b493c", roughness: 1 });
const undergroundFloor = new THREE.MeshStandardMaterial({ color: "#383930", roughness: 0.98 });
const undergroundTile = new THREE.MeshStandardMaterial({ color: "#676452", roughness: 0.95 });
const oldBrass = new THREE.MeshStandardMaterial({ color: "#665336", metalness: 0.55, roughness: 0.72 });

/** A cramped, repeating stone chamber with a stairwell marking the next room. */
export function UndergroundScene({ room }: { room: number }) {
  const half = 14;
  const tileLines = Array.from({ length: 13 }, (_, index) => index - 6);
  const roomTint = room % 3 === 0 ? "#514b3c" : room % 2 === 0 ? "#625d49" : "#6b6752";

  return (
    <>
      <color attach="background" args={["#11120f"]} />
      <fog attach="fog" args={["#171811", 9, 30]} />
      <hemisphereLight args={["#777768", "#181811", 0.62]} />
      <ambientLight color="#9b9878" intensity={0.28} />

      <mesh position={[0, -0.32, 0]} receiveShadow userData={{ solid: true }}>
        <boxGeometry args={[half * 2, 0.6, half * 2]} />
        <primitive object={undergroundFloor} attach="material" />
      </mesh>
      {tileLines.map((line) => (
        <group key={line}>
          <mesh position={[line * 2, 0.002, 0]} receiveShadow>
            <boxGeometry args={[0.035, 0.008, half * 2]} />
            <primitive object={undergroundTile} attach="material" />
          </mesh>
          <mesh position={[0, 0.002, line * 2]} receiveShadow>
            <boxGeometry args={[half * 2, 0.008, 0.035]} />
            <primitive object={undergroundTile} attach="material" />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 2.7, half]} receiveShadow userData={{ solid: true }}>
        <boxGeometry args={[half * 2, 5.4, 0.6]} />
        <meshStandardMaterial color={roomTint} roughness={0.98} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * half, 2.7, 0]} receiveShadow userData={{ solid: true }}>
            <boxGeometry args={[0.6, 5.4, half * 2]} />
            <meshStandardMaterial color={roomTint} roughness={0.98} />
          </mesh>
          <mesh position={[side * 10, 2.7, -half]} receiveShadow userData={{ solid: true }}>
            <boxGeometry args={[8, 5.4, 0.6]} />
            <meshStandardMaterial color={roomTint} roughness={0.98} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 5, -half]} receiveShadow userData={{ solid: true }}>
        <boxGeometry args={[12, 0.8, 0.6]} />
        <meshStandardMaterial color={roomTint} roughness={0.98} />
      </mesh>
      <mesh position={[0, 5.35, 0]} receiveShadow userData={{ solid: true }}>
        <boxGeometry args={[half * 2, 0.4, half * 2]} />
        <primitive object={undergroundStone} attach="material" />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={`pillar-${side}`}>
          <mesh position={[side * 10.8, 2.35, 9.5]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 4.7, 1.1]} />
            <meshStandardMaterial color={roomTint} roughness={1} />
          </mesh>
          <mesh position={[side * 10.8, 4.78, 9.5]} castShadow>
            <boxGeometry args={[1.45, 0.28, 1.45]} />
            <primitive object={oldBrass} attach="material" />
          </mesh>
        </group>
      ))}

      {[-6, 0, 6].map((x, index) => (
        <group key={`light-${x}`}>
          <mesh position={[x, 5.08, 2]} rotation-x={Math.PI / 2}>
            <boxGeometry args={[2.8, 0.08, 0.45]} />
            <meshStandardMaterial
              color={index === room % 3 ? "#756e52" : "#d3cfab"}
              emissive={index === room % 3 ? "#342d19" : "#6a654a"}
              emissiveIntensity={0.8}
              roughness={0.6}
            />
          </mesh>
          <pointLight position={[x, 4.8, 2]} color={index === room % 3 ? "#88734c" : "#d1cda9"} intensity={index === room % 3 ? 1.4 : 2.1} distance={13} />
        </group>
      ))}

      <group position={[0, 0, -13.6]}>
        {[0, 1, 2, 3].map((step) => (
          <mesh key={step} position={[0, 0.15 + step * 0.25, -step * 0.75]} receiveShadow>
            <boxGeometry args={[3.6 - step * 0.25, 0.3, 0.9]} />
            <primitive object={undergroundStone} attach="material" />
          </mesh>
        ))}
        <mesh position={[0, 1.15, -3.4]}>
          <boxGeometry args={[2.1, 0.08, 0.08]} />
          <meshStandardMaterial color="#a28d58" emissive="#574321" emissiveIntensity={0.5} />
        </mesh>
        <pointLight position={[0, 1.4, -3.8]} color="#bd9b54" intensity={1.3} distance={6} />
      </group>

      <mesh position={[0, 1.15, 13.66]} castShadow>
        <boxGeometry args={[3.4, 2.3, 0.05]} />
        <primitive object={oldBrass} attach="material" />
      </mesh>
      <mesh position={[0, 1.15, 13.6]}>
        <planeGeometry args={[1.8, 1.2]} />
        <meshBasicMaterial color="#171811" />
      </mesh>
      <pointLight position={[0, 2.8, 10.5]} color="#9c804e" intensity={0.8} distance={8} />
    </>
  );
}

