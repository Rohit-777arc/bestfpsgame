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

