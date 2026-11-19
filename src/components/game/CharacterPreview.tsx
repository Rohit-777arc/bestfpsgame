import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type * as THREE from "three";
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
          camera={{ position: [2.6, 1.9, 5.6], fov: 32, near: 0.1, far: 30 }}
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
          <mesh rotation-x={-Math.PI / 2} position-y={-0.015} receiveShadow>
            <circleGeometry args={[1.25, 48]} />
            <meshStandardMaterial color="#263940" roughness={0.85} />
          </mesh>
          <OrbitControls target={[0, 1.12, 0]} enablePan={false} makeDefault enableDamping dampingFactor={0.08} minDistance={4.5} maxDistance={7} minPolarAngle={0.7} maxPolarAngle={1.8} />
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
      <g transform="translate(0 -60)">
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
      </g>
      <rect x="58" y="24" width="64" height="64" fill={skinTone} />
      <path d="M58 24h64v18H58zm0 18h10v12H58zm54 0h10v12h-10z" fill={hairColor} />
      <path d="M70 54h12v9H70zm28 0h12v9H98z" fill="#f2e6d2" />
      <path d="M76 54h6v9h-6zm22 0h6v9h-6z" fill="#24313a" />
      <path d="M82 74h16v5H82z" fill="#754c3e" />
      {avatarColors && <rect x="61" y="69" width="58" height="15" fill={avatarColors.maskColor} />}
      {(hat || avatarColors) && <path d="M54 19h72v17H54z" fill={hatColor} />}
      {hat?.style === "cap" && <rect x="54" y="32" width="82" height="7" fill={hatColor} />}
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
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // Keep the feet planted and the face static; only the arms have a subtle idle pose.
    const idle = Math.sin(clock.elapsedTime * 1.2) * 0.025;
    if (leftArm.current) leftArm.current.rotation.z = idle;
    if (rightArm.current) rightArm.current.rotation.z = -idle;
  });
  const accent = shirtStyle === "armor" ? "#b4c2c9" : shirtStyle === "champion" ? "#fff0a0" : accessoriesColor;
  return (
    <group>
      <VoxelBox position={[0, 1.35, 0]} size={[.6, .9, .3]} color={shirtColor} />
      <VoxelBox position={[0, 2.1, 0]} size={[.6, .6, .6]} color={skinTone} />
      <VoxelBox position={[0, 2.37, 0]} size={[.612, .08, .612]} color={hairColor} />
      <VoxelBox position={[-.265, 2.23, -.01]} size={[.08, .2, .61]} color={hairColor} />
      <VoxelBox position={[.265, 2.23, -.01]} size={[.08, .2, .61]} color={hairColor} />
      <VoxelBox position={[0, 2.12, -.285]} size={[.6, .46, .06]} color={hairColor} />
      {[-1, 1].map(side => <group key={side}>
        {/* Each pixel sits in front of the previous surface, avoiding z-fighting. */}
        <VoxelBox position={[side * .15, 2.12, .308]} size={[.15, .075, .012]} color="#e9e5d8" />
        <VoxelBox position={[side * .12, 2.12, .32]} size={[.055, .075, .01]} color="#334a52" />
        <group position={[side * .45, 1.8, 0]} ref={side < 0 ? leftArm : rightArm}>
          <VoxelBox position={[0, -.3, 0]} size={[.3, .6, .3]} color={bodyColor} />
          <VoxelBox position={[0, -.75, 0]} size={[.3, .3, .3]} color={skinTone} />
        </group>
        <VoxelBox position={[side * .151, .54, 0]} size={[.298, .72, .3]} color={pantsColor} />
        <VoxelBox position={[side * .151, .09, .015]} size={[.298, .18, .33]} color={bootsColor} />
      </group>)}
      <VoxelBox position={[0, 1.95, .31]} size={[.15, .045, .018]} color="#795548" />
      {maskColor && <VoxelBox position={[0, 1.91, .33]} size={[.48, .16, .025]} color={maskColor} />}
      {(hatStyle || accessoriesColor) && <>
        <VoxelBox position={[0, 2.44, 0]} size={[.66, .12, .66]} color={hatColor} />
        {hatStyle === "cap" && <VoxelBox position={[0, 2.4, .37]} size={[.66, .04, .22]} color={hatColor} />}
      </>}
      {accent && <VoxelBox position={[0, 1.4, .17]} size={[.42, .45, .035]} color={accent} />}
      {shirtStyle === "vest" && [-1, 1].map(side => <VoxelBox key={side} position={[side * .18, 1.35, .18]} size={[.14, .65, .05]} color="#2e3b3a" />)}
      {(shirtStyle === "coat" || shirtStyle === "jacket" || shirtStyle === "hoodie") && <VoxelBox position={[0, 1.35, .17]} size={[.035, .75, .025]} color="#d1c4a3" />}
      {shirtStyle === "cloak" && <VoxelBox position={[0, 1.15, -.19]} size={[.65, 1.3, .04]} color={shirtColor} />}
      <group position={[.45, 1.02, .26]} rotation-x={-.12}>
        <VoxelBox position={[0, 0, 0]} size={[.13, .14, weaponId === "scout-pistol" ? .34 : .58]} color={weaponSkinColor ?? "#485356"} />
        <VoxelBox position={[0, -.12, -.05]} size={[.1, .18, .12]} color="#65513d" />
        <VoxelBox position={[0, .01, .32]} size={[.06, .06, .18]} color="#252d30" />
      </group>
    </group>
  );
}

function VoxelBox({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={.92} flatShading />
  </mesh>;
}
