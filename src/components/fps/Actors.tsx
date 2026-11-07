// Humanoid meshes: wave enemies, training dummies and remote players.
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Tier } from "@/game/sim/waves";

export type EnemyRuntime = {
  id: number;
  tier: Tier;
  hp: number;
  max: number;
  x: number;
  z: number;
  ry: number;
  speed: number;
  damage: number;
  reach: number;
  cd: number;
  alive: boolean;
  fall: number;
  phase: number;
  moving: boolean;
  goalX: number;
  goalZ: number;
  flash: number;
};

const G = {
  torso: new THREE.CapsuleGeometry(0.28, 0.55, 6, 12),
  head: new THREE.SphereGeometry(0.2, 16, 16),
  limb: new THREE.CapsuleGeometry(0.08, 0.5, 4, 8),
  leg: new THREE.CapsuleGeometry(0.1, 0.6, 4, 8),
  belt: new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16),
  eye: new THREE.CircleGeometry(0.12, 20),
  visor: new THREE.BoxGeometry(0.3, 0.08, 0.05),
};

const skin = new THREE.MeshStandardMaterial({ color: "#c8a77a", roughness: 0.85 });
const strap = new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 0.7 });
const bullseye = new THREE.MeshStandardMaterial({ color: "#a8322a", roughness: 0.8 });
const visorMat = new THREE.MeshStandardMaterial({ color: "#ffd23b", emissive: "#ffb000", emissiveIntensity: 0.8 });

export const TIER_LOOK: Record<Tier, { cloth: THREE.MeshStandardMaterial; scale: number }> = {
  grunt: { cloth: new THREE.MeshStandardMaterial({ color: "#6b6f4a", roughness: 0.95 }), scale: 1 },
  runner: { cloth: new THREE.MeshStandardMaterial({ color: "#2f6f8f", roughness: 0.9 }), scale: 0.9 },
  brute: { cloth: new THREE.MeshStandardMaterial({ color: "#8f2f2f", roughness: 0.9 }), scale: 1.35 },
};

const hitMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 1 });

type Tag = Record<string, unknown>;

function Body({ tag, cloth, refs }: {
  tag: Tag;
  cloth: THREE.Material;
  refs: {
    lLeg: React.RefObject<THREE.Group | null>;
    rLeg: React.RefObject<THREE.Group | null>;
    lArm: React.RefObject<THREE.Group | null>;
    rArm: React.RefObject<THREE.Group | null>;
  };
}) {
  const P = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number]) => (
    <mesh geometry={geo} material={mat} position={pos} castShadow userData={tag} />
  );
  return (
    <>
      {P(G.torso, cloth, [0, 1.3, 0])}
      {P(G.eye, bullseye, [0, 1.4, 0.29])}
      {P(G.belt, strap, [0, 0.98, 0])}
      {P(G.head, skin, [0, 1.95, 0])}
      <group ref={refs.lArm} position={[-0.38, 1.6, 0]}>{P(G.limb, cloth, [0, -0.32, 0])}</group>
      <group ref={refs.rArm} position={[0.38, 1.6, 0]}>{P(G.limb, cloth, [0, -0.32, 0])}</group>
      <group ref={refs.lLeg} position={[-0.14, 0.95, 0]}>{P(G.leg, strap, [0, -0.45, 0])}</group>
      <group ref={refs.rLeg} position={[0.14, 0.95, 0]}>{P(G.leg, strap, [0, -0.45, 0])}</group>
    </>
  );
}

function useLimbs() {
  return {
    lLeg: useRef<THREE.Group>(null),
    rLeg: useRef<THREE.Group>(null),
    lArm: useRef<THREE.Group>(null),
    rArm: useRef<THREE.Group>(null),
  };
}

function swing(limbs: ReturnType<typeof useLimbs>, w: number) {
  if (limbs.lLeg.current) limbs.lLeg.current.rotation.x = w;
  if (limbs.rLeg.current) limbs.rLeg.current.rotation.x = -w;
  if (limbs.lArm.current) limbs.lArm.current.rotation.x = -w * 0.8;
  if (limbs.rArm.current) limbs.rArm.current.rotation.x = w * 0.8;
}

export function EnemyMesh({ e }: { e: EnemyRuntime }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const limbs = useLimbs();
  const look = TIER_LOOK[e.tier];

  useFrame((s) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    g.position.set(e.x, 0, e.z);
    g.rotation.y = e.ry;
    if (!e.alive) {
      b.rotation.x = -e.fall * (Math.PI / 2) * 0.95;
      b.position.y = -e.fall * 0.4;
      g.visible = e.fall < 1.6;
      return;
    }
    g.visible = true;
    b.rotation.x = 0;
    const t = s.clock.elapsedTime * e.speed * 3 + e.phase;
    const w = e.moving ? Math.sin(t) * 0.6 : 0;
    swing(limbs, w);
    b.position.y = e.moving ? Math.abs(Math.cos(t)) * 0.05 : 0;
    if (limbs.rArm.current && e.cd > 0 && e.cd > 0.8) limbs.rArm.current.rotation.x = -1.6;
    // hit flash
    const flash = e.flash > 0;
    b.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (flash) {
        if (!m.userData.baseMat) m.userData.baseMat = m.material;
        m.material = hitMat;
      } else if (m.userData.baseMat) {
        m.material = m.userData.baseMat as THREE.Material;
      }
    });
  });

  return (
    <group ref={root} scale={look.scale}>
      <group ref={body}>
        <Body tag={{ enemyId: e.id }} cloth={look.cloth} refs={limbs} />
        {e.tier !== "grunt" && <mesh geometry={G.visor} material={visorMat} position={[0, 1.98, 0.18]} userData={{ enemyId: e.id }} />}
      </group>
    </group>
  );
}

export type RemoteRuntime = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  tx: number;
  ty: number;
  tz: number;
  tr: number;
  hp: number;
  seen: boolean;
};

const allyMat = new THREE.MeshStandardMaterial({ color: "#2f8f5a", roughness: 0.85 });
const foeMat = new THREE.MeshStandardMaterial({ color: "#c0392b", roughness: 0.85 });

export function RemoteMesh({ r, foe }: { r: RemoteRuntime; foe: boolean }) {
  const root = useRef<THREE.Group>(null);
  const limbs = useLimbs();
  const last = useRef({ x: 0, z: 0 });
  useFrame((s, raw) => {
    const g = root.current;
    if (!g) return;
    g.visible = r.seen && r.hp > 0;
    const dt = Math.min(raw, 0.05);
    const k = 1 - Math.exp(-12 * dt);
    const d = Math.hypot(r.tx - r.x, r.tz - r.z);
    if (d > 5) {
      r.x = r.tx;
      r.z = r.tz;
      r.y = r.ty;
    } else {
      r.x += (r.tx - r.x) * k;
      r.z += (r.tz - r.z) * k;
      r.y += (r.ty - r.y) * k;
    }
    const dy = r.tr - r.ry;
    r.ry += Math.atan2(Math.sin(dy), Math.cos(dy)) * k;
    g.position.set(r.x, r.y - 1.7, r.z);
    g.rotation.y = r.ry + Math.PI;
    const moving = Math.hypot(r.x - last.current.x, r.z - last.current.z) > 0.005;
    last.current = { x: r.x, z: r.z };
    swing(limbs, moving ? Math.sin(s.clock.elapsedTime * 10) * 0.6 : 0);
  });
  return (
    <group ref={root} visible={false}>
      <Body tag={{ remoteId: r.id }} cloth={foe ? foeMat : allyMat} refs={limbs} />
      <mesh position={[0, 2.35, 0]}>
        <octahedronGeometry args={[0.12]} />
        <meshBasicMaterial color={foe ? "#ff4d4d" : "#4dff9a"} />
      </mesh>
    </group>
  );
}
