import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { getCosmetic } from "@/game/sim/cosmetics";
import { getWeaponSkin, type WeaponSkinId } from "@/game/sim/gacha";
import type { AvatarColors } from "@/game/sim/avatar";
import { WEAPONS, type WeaponId } from "@/game/sim/weapons";

export function CharacterPreview({
  shirtId,
  hatId,
  pantsId = null,
  bootsId = null,
  compact = false,
  rotatable = false,
  weaponId = "scout-pistol",
  avatarColors,
  weaponSkinId = null,
  fireEffect = false,
}: {
  shirtId: string | null;
  hatId: string | null;
  pantsId?: string | null;
  bootsId?: string | null;
  compact?: boolean;
  rotatable?: boolean;
  weaponId?: WeaponId;
  avatarColors?: AvatarColors | undefined;
  weaponSkinId?: WeaponSkinId | null | undefined;
  fireEffect?: boolean;
}) {
  const previewId = useId();
  const previewRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === previewRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);
  const shirt = getCosmetic(shirtId);
  const hat = getCosmetic(hatId);
  const pants = getCosmetic(pantsId);
  const boots = getCosmetic(bootsId);
  const weaponSkin = getWeaponSkin(weaponSkinId);
  const shirtColor = avatarColors?.dressColor ?? shirt?.color ?? "#53677a";
  const bodyColor = avatarColors?.bodyColor ?? shirtColor;
  const hatColor = avatarColors?.hatColor ?? hat?.color ?? "#394554";
  const pantsColor = avatarColors?.feetColor ?? pants?.color ?? "#34383b";
  const bootsColor = avatarColors?.bootsColor ?? boots?.color ?? "#22272a";
  const skinTone = avatarColors?.headColor ?? "#c8a77a";
  const hairColor = avatarColors?.hairColor ?? "#382c2a";

  if (rotatable) {
    return (
      <div
        ref={previewRef}
        className={`character-preview character-preview-3d${fullscreen ? " character-preview-fullscreen" : ""}`}
        role="group"
        aria-label={`Rotatable blocky character wearing ${shirt?.name ?? "standard uniform"} and holding ${WEAPONS[weaponId].name}`}
      >
        <Canvas
          camera={{ position: [3.3, 2.2, 4], fov: 34 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          }}
        >
          <color attach="background" args={["#17242b"]} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[3, 6, 4]} intensity={3} castShadow />
          <pointLight position={[-3, 2, -3]} intensity={18} color="#ff6a1a" />
          {fireEffect && <pointLight position={[0, 0.3, 0]} intensity={2.2} color="#ff3a12" distance={3} />}
          <BlockyOperator
            shirtColor={shirtColor}
            bodyColor={bodyColor}
            hatColor={hatColor}
            pantsColor={pantsColor}
            bootsColor={bootsColor}
            accessoriesColor={avatarColors?.accessoriesColor}
            maskColor={avatarColors?.maskColor}
            hatStyle={hat?.style}
            shirtStyle={shirt?.style}
            skinTone={skinTone}
            hairColor={hairColor}
            weaponSkinColor={weaponSkin?.color}
            weaponId={weaponId}
            fireEffect={fireEffect}
          />
          <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow>
            <circleGeometry args={[1.25, 48]} />
            <meshStandardMaterial color="#263940" roughness={0.85} />
          </mesh>
          <OrbitControls enablePan={false} minDistance={3.5} maxDistance={6} minPolarAngle={0.7} maxPolarAngle={1.8} />
        </Canvas>
        <span className="character-preview-hint">DRAG TO ROTATE</span>
        <button
          type="button"
          className="character-preview-fullscreen-button"
          aria-label={
            fullscreen ? "Exit fullscreen character preview" : "View character fullscreen"
          }
          onClick={() => {
            const fullscreenChange =
              document.fullscreenElement === previewRef.current
                ? document.exitFullscreen()
                : previewRef.current?.requestFullscreen();
            setFullscreenError(false);
            void fullscreenChange?.catch(() => setFullscreenError(true));
          }}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {fullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
        {fullscreenError && (
          <span className="character-preview-fullscreen-error" role="status">
            Fullscreen is unavailable in this browser.
          </span>
        )}
      </div>
    );
  }

  return (
    <svg
      className={compact ? "character-preview character-preview-compact" : "character-preview"}
      viewBox="0 0 180 220"
      role="img"
      aria-label={`Character wearing ${shirt?.name ?? "standard uniform"} and ${hat?.name ?? "no hat"}`}
    >
      <defs>
        <linearGradient id={`preview-bg-${previewId}`} x2="0" y2="1">
          <stop stopColor="#263a42" />
          <stop offset="1" stopColor="#121b23" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="172" height="212" rx="18" fill={`url(#preview-bg-${previewId})`} />
      <path d="M58 148h64l12 65h-28l-9-42-10 42H48z" fill={pantsColor} />
      <path d="M49 204h34v11H45zm43 0h34v11H91z" fill={bootsColor} />
      <path d="M25 213c3-39 24-64 65-64s62 25 65 64" fill={shirtColor} />
      {avatarColors && <path d="m70 157 20 8 20-8v39H70z" fill={bodyColor} />}
      {shirt?.style === "coat" && (
        <path d="m75 152 15 23 15-23 13 61H62z" fill="#d5aa73" opacity=".8" />
      )}
      {shirt?.style === "vest" && (
        <path d="m62 154 12 59h32l12-59-18 12H80z" fill="#283746" opacity=".75" />
      )}
      {shirt?.style === "jacket" && (
        <>
          <path d="m88 151-12 62h-9l10-65m11 3 12 62h9l-10-65" fill="#d8fff1" opacity=".85" />
          <path d="M43 180h16m62 0h16" stroke="#53fff0" strokeWidth="5" />
        </>
      )}
      {shirt?.style === "armor" && (
        <>
          <path d="m55 163 16-10 19 10 19-10 16 10-10 50H65z" fill="#a9bac5" opacity=".55" />
          <path d="m90 164 8 15-8 9-8-9z" fill="#f3c65e" />
        </>
      )}
      {shirt?.style === "hoodie" && (
        <>
          <path d="M68 157q22-23 44 0l-7 12H75z" fill="#612333" />
          <path d="M90 170v29m-8 0h16" stroke="#f4c9c9" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {shirt?.style === "champion" && (
        <>
          <path d="m90 157 6 8-6 8-6-8z" fill="#fff1a8" />
          <path d="M54 185h18m54 0h-18" stroke="#fff1a8" strokeWidth="4" />
        </>
      )}
      {shirt?.style === "cloak" && (
        <path d="m69 154 21 9 21-9 22 59H47z" fill="#292438" opacity=".62" />
      )}
      <path d="M79 122h22v32H79z" fill={skinTone} />
      <ellipse cx="90" cy="94" rx="39" ry="45" fill={skinTone} />
      {avatarColors && <path d="M56 100h68v17H56z" fill={avatarColors.maskColor} />}
      <path
        d="M52 91c0-37 18-55 42-55 27 0 41 21 38 56-8-15-21-19-34-22-17-4-30 2-46 21Z"
        fill={hairColor}
      />
      <g className="profile-moving-eyes">
        <ellipse cx="74" cy="95" rx="5" ry="7" fill="#f2e6d2" />
        <ellipse cx="106" cy="95" rx="5" ry="7" fill="#f2e6d2" />
        <circle cx="74" cy="96" r="2.2" fill="#24313a" />
        <circle cx="106" cy="96" r="2.2" fill="#24313a" />
      </g>
      <path
        d="M83 115q7 5 14 0"
        fill="none"
        stroke="#754c3e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {hat?.style === "cap" && (
        <path
          d="M49 66c4-26 20-40 42-40s38 14 42 40H49Zm63 3c19 0 29 4 35 12-17 1-30-1-40-7"
          fill={hatColor}
        />
      )}
      {hat?.style === "helmet" && (
        <path d="M47 70c0-31 16-49 43-49s43 18 43 49H47Zm-4 5h94v9H43z" fill={hatColor} />
      )}
      {avatarColors && !hat && (
        <path d="M49 66c4-26 20-40 42-40s38 14 42 40H49z" fill={hatColor} />
      )}
      <path d="m48 173 17-11m67 11-17-11" stroke="oklch(1 0 0 / .2)" strokeWidth="2" />
    </svg>
  );
}

function BlockyOperator({
  shirtColor,
  bodyColor,
  hatColor,
  pantsColor,
  bootsColor,
  accessoriesColor,
  maskColor,
  hatStyle,
  shirtStyle,
  skinTone,
  hairColor,
  weaponSkinColor,
  weaponId,
  fireEffect,
}: {
  shirtColor: string;
  bodyColor: string;
  hatColor: string;
  pantsColor: string;
  bootsColor: string;
  accessoriesColor?: string | undefined;
  maskColor?: string | undefined;
  hatStyle?: string | undefined;
  shirtStyle?: string | undefined;
  skinTone: string;
  hairColor: string;
  weaponSkinColor?: string | undefined;
  weaponId: WeaponId;
  fireEffect: boolean;
}) {
  const body = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const fire = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (body.current) body.current.position.y = 0.03 + Math.sin(time * 1.7) * 0.025;
    if (leftArm.current) leftArm.current.rotation.x = Math.sin(time * 1.7) * 0.07;
    if (rightArm.current) rightArm.current.rotation.x = -Math.sin(time * 1.7) * 0.07;
    if (leftLeg.current) leftLeg.current.rotation.x = -Math.sin(time * 1.7) * 0.045;
    if (rightLeg.current) rightLeg.current.rotation.x = Math.sin(time * 1.7) * 0.045;
    const eyeX = Math.sin(time * 0.75) * 0.018;
    const eyeY = Math.max(-0.012, Math.min(0.012, Math.cos(time * 0.9) * 0.012));
    if (leftEye.current) leftEye.current.position.set(-0.17 + eyeX, 1.9 + eyeY, 0.29);
    if (rightEye.current) rightEye.current.position.set(0.17 + eyeX, 1.9 + eyeY, 0.29);
    if (fire.current) {
      fire.current.rotation.y = time * 0.45;
      fire.current.scale.setScalar(1 + Math.sin(time * 4) * 0.035);
    }
  });
  const weapon = WEAPONS[weaponId];
  const skin = skinTone;
  const hasCustomAvatar = accessoriesColor !== undefined;
  const dark = new THREE.Color(shirtColor).multiplyScalar(0.55).getStyle();
  return (
    <group ref={body} position-y={0.03}>
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[0.38, 0.92, 0.42]} />
        <meshStandardMaterial color="#27333a" />
      </mesh>
      <mesh position={[0, 1.22, 0]} castShadow>
        <boxGeometry args={[0.72, 0.78, 0.42]} />
        <meshStandardMaterial color={shirtColor} roughness={0.78} />
      </mesh>
      {hasCustomAvatar && (
        <>
          <mesh position={[-0.45, 1.55, 0]}>
            <boxGeometry args={[0.13, 0.12, 0.25]} />
            <meshStandardMaterial color={accessoriesColor} metalness={0.55} />
          </mesh>
          <mesh position={[0.45, 1.55, 0]}>
            <boxGeometry args={[0.13, 0.12, 0.25]} />
            <meshStandardMaterial color={accessoriesColor} metalness={0.55} />
          </mesh>
        </>
      )}
      {shirtStyle === "armor" && (
        <>
          <mesh position={[0, 1.28, 0.22]}>
            <boxGeometry args={[0.38, 0.38, 0.045]} />
            <meshStandardMaterial color="#b4c2c9" metalness={0.6} roughness={0.36} />
          </mesh>
          <mesh position={[0, 1.27, 0.25]}>
            <boxGeometry args={[0.12, 0.14, 0.06]} />
            <meshStandardMaterial color="#f0c255" emissive="#a66b08" emissiveIntensity={0.3} />
          </mesh>
        </>
      )}
      {shirtStyle === "vest" && (
        <>
          <mesh position={[-0.14, 1.26, 0.23]}>
            <boxGeometry args={[0.17, 0.48, 0.07]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0.14, 1.26, 0.23]}>
            <boxGeometry args={[0.17, 0.48, 0.07]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0, 1.3, 0.275]}>
            <boxGeometry args={[0.055, 0.22, 0.025]} />
            <meshStandardMaterial color="#d5b36c" metalness={0.45} />
          </mesh>
        </>
      )}
      {shirtStyle === "coat" && (
        <>
          <mesh position={[-0.12, 1.3, 0.24]} rotation-z={-0.18}>
            <boxGeometry args={[0.15, 0.45, 0.06]} />
            <meshStandardMaterial color="#ead2b1" roughness={0.82} />
          </mesh>
          <mesh position={[0.12, 1.3, 0.24]} rotation-z={0.18}>
            <boxGeometry args={[0.15, 0.45, 0.06]} />
            <meshStandardMaterial color="#ead2b1" roughness={0.82} />
          </mesh>
        </>
      )}
      {shirtStyle === "jacket" && (
        <mesh position={[0, 1.26, 0.23]}>
          <boxGeometry args={[0.06, 0.56, 0.035]} />
          <meshStandardMaterial color="#b4fff3" emissive="#30cfc1" emissiveIntensity={0.7} />
        </mesh>
      )}
      {shirtStyle === "hoodie" && (
        <mesh position={[0, 1.56, -0.25]}>
          <boxGeometry args={[0.42, 0.32, 0.16]} />
          <meshStandardMaterial color="#612333" roughness={0.98} />
        </mesh>
      )}
      {shirtStyle === "cloak" && (
        <mesh position={[0, 1.12, -0.24]}>
          <boxGeometry args={[0.74, 0.95, 0.12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      )}
      {shirtStyle === "champion" && (
        <mesh position={[0, 1.26, 0.23]}>
          <boxGeometry args={[0.15, 0.2, 0.04]} />
          <meshStandardMaterial color="#fff0a0" metalness={0.7} />
        </mesh>
      )}
      <mesh position={[0, 1.88, 0]} castShadow>
        <boxGeometry args={[0.58, 0.58, 0.54]} />
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
      {maskColor && (
        <mesh position={[0, 1.82, 0.29]}>
          <boxGeometry args={[0.46, 0.18, 0.075]} />
          <meshStandardMaterial color={maskColor} roughness={0.7} />
        </mesh>
      )}
      <mesh position={[0, 2.12, 0]}>
        <boxGeometry args={[0.6, 0.16, 0.56]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>
      <mesh ref={leftEye} position={[-0.17, 1.9, 0.29]}>
        <boxGeometry args={[0.08, 0.09, 0.025]} />
        <meshStandardMaterial color="#182326" emissive="#2d5560" emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={rightEye} position={[0.17, 1.9, 0.29]}>
        <boxGeometry args={[0.08, 0.09, 0.025]} />
        <meshStandardMaterial color="#182326" emissive="#2d5560" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-0.17, 1.9, 0.29]}>
        <boxGeometry args={[0.09, 0.045, 0.025]} />
        <meshStandardMaterial color="#f0d7b6" />
      </mesh>
      <mesh position={[0.17, 1.9, 0.29]}>
        <boxGeometry args={[0.09, 0.045, 0.025]} />
        <meshStandardMaterial color="#f0d7b6" />
      </mesh>
      {(hatStyle === "helmet" || (hatStyle === undefined && accessoriesColor !== undefined)) && (
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[0.72, 0.2, 0.68]} />
          <meshStandardMaterial color={hatColor} metalness={0.3} roughness={0.55} />
        </mesh>
      )}
      {hatStyle === "cap" && (
        <mesh position={[0, 2.23, 0.05]}>
          <boxGeometry args={[0.64, 0.14, 0.62]} />
          <meshStandardMaterial color={hatColor} />
        </mesh>
      )}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <group ref={side < 0 ? leftArm : rightArm} position={[side * 0.45, 1.58, 0]}>
            <mesh position={[0, -0.35, 0]} castShadow>
              <boxGeometry args={[0.2, 0.7, 0.22]} />
              <meshStandardMaterial color={bodyColor} />
            </mesh>
            <mesh position={[0, -0.72, 0]} castShadow>
              <boxGeometry args={[0.2, 0.14, 0.22]} />
              <meshStandardMaterial color={skin} />
            </mesh>
          </group>
          <group ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.2, 0.1, 0]}>
            <mesh position={[0, 0.32, 0]} castShadow>
              <boxGeometry args={[0.32, 0.72, 0.34]} />
              <meshStandardMaterial color={pantsColor} roughness={0.95} />
            </mesh>
            <mesh position={[0, -0.1, 0.06]} castShadow>
              <boxGeometry args={[0.34, 0.2, 0.5]} />
              <meshStandardMaterial color={bootsColor} roughness={0.88} />
            </mesh>
          </group>
        </group>
      ))}
      {fireEffect && (
        <group ref={fire} position-y={0.05}>
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.48, 0.055, 8, 32]} />
            <meshBasicMaterial color="#ff3b18" transparent opacity={0.72} />
          </mesh>
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            return (
              <mesh
                key={index}
                position={[Math.cos(angle) * 0.44, 0.24 + (index % 2) * 0.07, Math.sin(angle) * 0.44]}
                rotation-z={Math.cos(angle) * -0.2}
                rotation-x={Math.sin(angle) * 0.2}
              >
                <coneGeometry args={[0.12, 0.52, 5]} />
                <meshBasicMaterial
                  color={index % 2 ? "#ff741a" : "#f53618"}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            );
          })}
        </group>
      )}
      <group position={[0.55, 1.03, 0.32]} rotation-x={-0.12}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.16, 0.52]} />
          <meshStandardMaterial color={weaponSkinColor ?? "#343a40"} metalness={0.65} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.015, 0.31]}>
          <boxGeometry args={[0.055, 0.055, 0.25]} />
          <meshStandardMaterial color="#17191b" metalness={0.8} roughness={0.28} />
        </mesh>
        <mesh position={[0, -0.14, -0.04]} rotation-x={0.2}>
          <boxGeometry args={[0.12, 0.22, 0.14]} />
          <meshStandardMaterial color="#66462d" />
        </mesh>
        <mesh position={[0, 0.12, -0.08]}>
          <boxGeometry args={[0.08, 0.09, 0.16]} />
          <meshStandardMaterial
            color={weapon.id === "riot-shotgun" ? "#b98246" : "#59646b"}
            metalness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}
