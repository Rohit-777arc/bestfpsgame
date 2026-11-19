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
          camera={{ position: [2.5, 1.9, 4.8], fov: 34 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          }}
        >
          <color attach="background" args={["#17242b"]} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[3, 6, 4]} intensity={3} castShadow />
          <pointLight position={[-3, 2, -3]} intensity={18} color="#b9d6e0" />
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
          />
          <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow>
            <circleGeometry args={[1.25, 48]} />
            <meshStandardMaterial color="#263940" roughness={0.85} />
          </mesh>
          <OrbitControls target={[0, 1.12, 0]} enablePan={false} minDistance={3.5} maxDistance={6} minPolarAngle={0.7} maxPolarAngle={1.8} />
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
      <rect x="61" y="147" width="27" height="56" fill={pantsColor} />
      <rect x="92" y="147" width="27" height="56" fill={pantsColor} />
      <path d="M61 199h27v14H61zm31 0h27v14H92z" fill={bootsColor} />
      <rect x="59" y="94" width="62" height="58" fill={shirtColor} />
      <path d="M29 94h27v58H29zm95 0h27v58h-27z" fill={bodyColor} />
      <path d="M29 142h27v14H29zm95 0h27v14h-27z" fill={skinTone} />
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
      <rect x="58" y="24" width="64" height="64" fill={skinTone} />
      <path d="M58 24h64v18H58zm0 18h10v12H58zm54 0h10v12h-10z" fill={hairColor} />
      <path d="M70 54h12v9H70zm28 0h12v9H98z" fill="#f2e6d2" />
      <path d="M76 54h6v9h-6zm22 0h6v9h-6z" fill="#24313a" />
      <path d="M82 74h16v5H82z" fill="#754c3e" />
      {avatarColors && <rect x="61" y="69" width="58" height="15" fill={avatarColors.maskColor} />}
      {(hat || avatarColors) && <path d="M54 19h72v17H54z" fill={hatColor} />}
      {hat?.style === "cap" && <rect x="54" y="32" width="82" height="7" fill={hatColor} />}
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
}) {
  const body = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (body.current) body.current.position.y = 0.03 + Math.sin(time * 1.7) * 0.025;
    if (leftArm.current) leftArm.current.rotation.x = Math.sin(time * 1.7) * 0.07;
    if (rightArm.current) rightArm.current.rotation.x = -Math.sin(time * 1.7) * 0.07;
    if (leftLeg.current) leftLeg.current.rotation.x = -Math.sin(time * 1.7) * 0.045;
    if (rightLeg.current) rightLeg.current.rotation.x = Math.sin(time * 1.7) * 0.045;
    const eyeX = Math.sin(time * 0.75) * 0.018;
    const eyeY = Math.max(-0.012, Math.min(0.012, Math.cos(time * 0.9) * 0.012));
    if (leftEye.current) leftEye.current.position.set(-0.17 + eyeX, 1.96 + eyeY, 0.37);
    if (rightEye.current) rightEye.current.position.set(0.17 + eyeX, 1.96 + eyeY, 0.37);

  });
  const weapon = WEAPONS[weaponId];
  const skin = skinTone;
  const hasCustomAvatar = accessoriesColor !== undefined;
  const dark = new THREE.Color(shirtColor).multiplyScalar(0.55).getStyle();
  return (
    <group ref={body} position-y={0.03}>
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
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
      {maskColor && (
        <mesh position={[0, 1.77, 0.38]}>
          <boxGeometry args={[0.64, 0.18, 0.045]} />
          <meshStandardMaterial color={maskColor} roughness={0.7} />
        </mesh>
      )}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.74, 0.16, 0.74]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>
      <mesh ref={leftEye} position={[-0.17, 1.96, 0.37]}>
        <boxGeometry args={[0.08, 0.09, 0.025]} />
        <meshStandardMaterial color="#182326" emissive="#2d5560" emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={rightEye} position={[0.17, 1.96, 0.37]}>
        <boxGeometry args={[0.08, 0.09, 0.025]} />
        <meshStandardMaterial color="#182326" emissive="#2d5560" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-0.17, 1.96, 0.37]}>
        <boxGeometry args={[0.09, 0.045, 0.025]} />
        <meshStandardMaterial color="#f0d7b6" />
      </mesh>
      <mesh position={[0.17, 1.96, 0.37]}>
        <boxGeometry args={[0.09, 0.045, 0.025]} />
        <meshStandardMaterial color="#f0d7b6" />
      </mesh>
      {(hatStyle === "helmet" || (hatStyle === undefined && accessoriesColor !== undefined)) && (
        <mesh position={[0, 2.28, 0]}>
          <boxGeometry args={[0.78, 0.16, 0.78]} />
          <meshStandardMaterial color={hatColor} metalness={0.3} roughness={0.55} />
        </mesh>
      )}
      {hatStyle === "cap" && (
        <mesh position={[0, 2.28, 0.05]}>
          <boxGeometry args={[0.76, 0.14, 0.8]} />
          <meshStandardMaterial color={hatColor} />
        </mesh>
      )}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <group ref={side < 0 ? leftArm : rightArm} position={[side * 0.54, 1.58, 0]}>
            <mesh position={[0, -0.35, 0]} castShadow>
              <boxGeometry args={[0.34, 0.64, 0.42]} />
              <meshStandardMaterial color={bodyColor} />
            </mesh>
            <mesh position={[0, -0.72, 0]} castShadow>
              <boxGeometry args={[0.34, 0.14, 0.42]} />
              <meshStandardMaterial color={skin} />
            </mesh>
          </group>
          <group ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.2, 0.1, 0]}>
            <mesh position={[0, 0.32, 0]} castShadow>
              <boxGeometry args={[0.35, 0.72, 0.42]} />
              <meshStandardMaterial color={pantsColor} roughness={0.95} />
            </mesh>
            <mesh position={[0, -0.1, 0.06]} castShadow>
              <boxGeometry args={[0.35, 0.2, 0.44]} />
              <meshStandardMaterial color={bootsColor} roughness={0.88} />
            </mesh>
          </group>
        </group>
      ))}
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
