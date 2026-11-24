// Draws the arena for a map preset: sky, fog, lights, ground, walls, props.
import { useMemo, useEffect, type RefObject } from "react";
import { ROOM_TABLES, ROOM_CHESTS, DOOR_Z } from "@/game/sim/underground";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { MapDef } from "@/game/sim/maps";
import { ARENA, BARRELS, CRATES, WALLS } from "@/game/sim/arena";
import { dungeonTexture, groundTexture, crateTexture } from "./textures";

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

      {map.trees && <JungleProps />}
      {map.lava && <LavaProps />}

      {map.neonSigns &&
        CRATES.slice(0, 6).map((c, i) => (
          <pointLight key={"pl" + i} position={[c.x, c.s + 1.2, c.z]} color={SIGNS[i % 4].color} intensity={6} distance={9} />
        ))}
    </>
  );
}

// Decorative trees around the jungle arena edge (walk-through, outside the crate rings).
const TREES = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.07;
  const r = 31 + (i % 4) * 2;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 7 + (i % 5) * 1.6, s: 2.2 + (i % 3) * 0.6 };
});

function JungleProps() {
  return (
    <>
      {TREES.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation-y={i * 1.3}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.5, t.h, 8]} />
            <meshStandardMaterial color="#5a4128" roughness={1} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[(k - 1) * 0.6, t.h - k * 0.9, (k % 2) * 0.5]} castShadow>
              <icosahedronGeometry args={[t.s - k * 0.35, 1]} />
              <meshStandardMaterial color={["#3f6b2a", "#4d7d30", "#36602a"][k]} roughness={0.95} flatShading />
            </mesh>
          ))}
          <mesh position={[0.4, t.h * 0.45, 0.3]}>
            <boxGeometry args={[0.06, t.h * 0.7, 0.06]} />
            <meshStandardMaterial color="#4f7a2c" />
          </mesh>
        </group>
      ))}
      {/* moss patches and ferns */}
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={"f" + i} position={[Math.cos(i * 2.1) * (8 + (i * 7) % 26), 0.25, Math.sin(i * 2.1) * (8 + (i * 7) % 26)]} rotation-y={i}>
          <coneGeometry args={[0.5 + (i % 3) * 0.2, 0.6, 5]} />
          <meshStandardMaterial color={i % 2 ? "#4f8a34" : "#3f7029"} flatShading />
        </mesh>
      ))}
      {/* mossy ruin tower in one corner */}
      <group position={[-30, 0, -30]}>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[0, 1.5 + k * 3, 0]} castShadow receiveShadow>
            <boxGeometry args={[6 - k * 0.8, 3, 6 - k * 0.8]} />
            <meshStandardMaterial color={k % 2 ? "#6f7a5a" : "#5d6a48"} roughness={1} />
          </mesh>
        ))}
      </group>
    </>
  );
}

const LAVA_POOLS = [
  { x: 28, z: 28, r: 4.5 },
  { x: -28, z: 27, r: 3.8 },
  { x: 29, z: -27, r: 4 },
  { x: -27, z: -29, r: 4.6 },
  { x: 0, z: 33, r: 3.2 },
];

function LavaProps() {
  return (
    <>
      {LAVA_POOLS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
            <circleGeometry args={[p.r + 0.6, 24]} />
            <meshStandardMaterial color="#1a0e0a" roughness={1} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
            <circleGeometry args={[p.r, 24]} />
            <meshStandardMaterial color="#ff5a1a" emissive="#ff4a10" emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 1.4, 0]} color="#ff6a2a" intensity={14} distance={14} decay={1.6} />
        </group>
      ))}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        return (
          <group key={"p" + i} position={[Math.cos(a) * 35, 0, Math.sin(a) * 35]}>
            <mesh position={[0, 4, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.9, 1.1, 8, 10]} />
              <meshStandardMaterial color="#5a4038" roughness={0.95} />
            </mesh>
            <mesh position={[0, 8.2, 0]}>
              <boxGeometry args={[2.4, 0.5, 2.4]} />
              <meshStandardMaterial color="#4a3530" roughness={1} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function RoomBox({ position, size, color, map, metal = false }: {
  position: [number, number, number]; size: [number, number, number]; color: string; map?: THREE.Texture; metal?: boolean;
}) {
  return <mesh position={position} castShadow receiveShadow userData={{ solid: true }}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} map={map ?? null} roughness={metal ? .68 : .96} metalness={metal ? .55 : 0} />
  </mesh>;
}

/** Warm, readable abandoned chambers with a gated stairwell and physical furniture. */
export function UndergroundScene({ room, doorRef }: { room: number; doorRef: RefObject<THREE.Group | null> }) {
  const textures = useMemo(() => ({ stone: dungeonTexture('stone'), floor: dungeonTexture('floor'), wood: dungeonTexture('wood') }), []);
  useEffect(() => () => Object.values(textures).forEach(texture => texture.dispose()), [textures]);
  const tint = ['#d2c6ae', '#b9c5bd', '#c8c0b4'][Math.max(0, room - 1) % 3];
  return <>
    <color attach="background" args={["#393c36"]} />
    <fog attach="fog" args={["#65695e", 26, 72]} />
    <hemisphereLight args={["#eee5cb", "#737c66", 2]} />
    <ambientLight color="#fff0d7" intensity={1.1} />
    <RoomBox position={[0, -.31, 0]} size={[48, .6, 48]} color="#c0bdaf" map={textures.floor} />
    <RoomBox position={[0, 2.7, 24]} size={[48, 5.4, .6]} color={tint} map={textures.stone} />
    <RoomBox position={[0, 2.7, -24]} size={[48, 5.4, .6]} color={tint} map={textures.stone} />
    <RoomBox position={[0, 5.5, 0]} size={[48, .4, 48]} color="#9a9689" map={textures.stone} />
    {[-1, 1].map(side => <group key={side}>
      <RoomBox position={[side * 24, 2.7, 0]} size={[.6, 5.4, 48]} color={tint} map={textures.stone} />
      <RoomBox position={[side * 13.5, 2.7, DOOR_Z]} size={[21, 5.4, .7]} color={tint} map={textures.stone} />
      {[ -12, 9.5 ].map(z => <group key={z}>
        <RoomBox position={[side * 21.5, 2.55, z]} size={[.85, 5.1, 1.1]} color="#a7a494" map={textures.stone} />
        <RoomBox position={[side * 21.5, .25, z]} size={[1.15, .5, 1.4]} color="#7b7c6a" />
      </group>)}
      <RoomBox position={[side * 23.5, .6, 0]} size={[.08, .9, 47]} color="#626b4d" />
      <RoomBox position={[side * 22.8, 4.6, 0]} size={[.18, .18, 46]} color="#766445" metal />
      {[ -10, 4, 17 ].map((z, index) => <group key={z}>
        <RoomBox position={[side * 23.3, 3.6, z]} size={[.26, .65, .45]} color="#4d4d40" metal />
        <mesh position={[side * 23.1, 3.6, z]}>
          <boxGeometry args={[.18, .4, .27]} />
          <meshStandardMaterial color="#ffe3ac" emissive="#ffce83" emissiveIntensity={2.2} />
        </mesh>
        <pointLight position={[side * 19.5, 3.4, z]} color={index === room % 3 ? '#f5e0b9' : '#ffe4b4'} intensity={32} distance={32} decay={1.5} />
      </group>)}
    </group>)}
    <RoomBox position={[0, 4.95, DOOR_Z]} size={[6, .9, .8]} color="#8c8c7a" map={textures.stone} />
    {[-2.9, 2.9].map(x => <RoomBox key={x} position={[x, 2.2, DOOR_Z + .1]} size={[.35, 4.4, .85]} color="#8c8c7a" map={textures.stone} />)}
    <group ref={doorRef} position={[0, 0, DOOR_Z]}>
      {[-1, 1].map(side => <group key={side} position={[side * 2.6, 0, 0]}>
        <RoomBox position={[-side * 1.3, 2.05, 0]} size={[2.6, 4.1, .22]} color="#958068" map={textures.wood} />
        {[.55, 2.05, 3.55].map(y => <RoomBox key={y} position={[-side * 1.3, y, .16]} size={[2.55, .16, .1]} color="#575c55" metal />)}
        <RoomBox position={[-side * 2.25, 1.85, .23]} size={[.14, .42, .14]} color="#b79c62" metal />
      </group>)}
    </group>
    <pointLight position={[0, 3.5, -16]} intensity={40} color="#ffe5b6" distance={22} decay={1.5} />
    {[0, 1, 2, 3].map(step => <RoomBox key={step} position={[0, .1 + step * .1, -19.8 - step * .65]} size={[4.8, .2 + step * .2, .65]} color="#a19e8d" map={textures.stone} />)}
    <mesh position={[0, 4.35, DOOR_Z + .48]}>
      <planeGeometry args={[1.4, .18]} />
      <meshBasicMaterial color="#c9dca9" />
    </mesh>
    {ROOM_TABLES.map((table, index) => <group key={index} position={[table.x, 0, table.z]}>
      <RoomBox position={[0, 1.2, 0]} size={[table.width, .18, table.depth]} color="#aa9270" map={textures.wood} />
      {[-1, 1].flatMap(x => [-1, 1].map(z => <RoomBox key={`${x}:${z}`} position={[x * (table.width / 2 - .2), .56, z * .55]} size={[.18, 1.12, .18]} color="#65563e" map={textures.wood} />))}
      <RoomBox position={[.6, 1.35, .25]} size={[.38, .12, .24]} color="#a6a08a" />
      <RoomBox position={[-.7, 1.33, -.25]} size={[.5, .07, .35]} color="#d7caa7" />
    </group>)}
    {ROOM_CHESTS.map((chest, index) => <group key={index} position={[chest.x, 0, chest.z]} rotation-y={index % 2 ? -.18 : .15}>
      <RoomBox position={[0, .5, 0]} size={[chest.width, 1, chest.depth]} color="#9d764a" map={textures.wood} />
      <RoomBox position={[0, 1.06, 0]} size={[chest.width + .08, .22, chest.depth + .08]} color="#795c39" map={textures.wood} />
      {[-.65, .65].map(x => <RoomBox key={x} position={[x, .58, .67]} size={[.13, 1.04, .06]} color="#505950" metal />)}
      <RoomBox position={[0, .87, .72]} size={[.24, .32, .12]} color="#af9256" metal />
    </group>)}
    {/* Stable patches of damp plaster, fallen masonry, and abandoned boards. */}
    {Array.from({ length: 16 }, (_, i) => <group key={i} position={[(i % 2 ? 1 : -1) * (16 + i % 5), 0, -13 + (i * 7 % 32)]} rotation-y={i * 1.7}>
      <RoomBox position={[0, .1, 0]} size={[.4 + i % 3 * .16, .2, .35]} color={i % 2 ? '#92927e' : '#b4ae9c'} />
      {i % 3 === 0 && <RoomBox position={[.5, .07, .2]} size={[1.5, .1, .2]} color="#786449" map={textures.wood} />}
    </group>)}
    {[ -9, 8 ].map(x => <RoomBox key={x} position={[x, 5.15, 0]} size={[.24, .25, 47]} color="#5a5445" metal />)}
  </>;
}
