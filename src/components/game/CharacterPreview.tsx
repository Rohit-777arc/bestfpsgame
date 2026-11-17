import { useId } from "react";
import { getCosmetic } from "@/game/sim/cosmetics";

export function CharacterPreview({
  shirtId,
  hatId,
  compact = false,
}: {
  shirtId: string | null;
  hatId: string | null;
  compact?: boolean;
}) {
  const previewId = useId();
  const shirt = getCosmetic(shirtId);
  const hat = getCosmetic(hatId);
  const shirtColor = shirt?.color ?? "#53677a";
  const hatColor = hat?.color ?? "#394554";

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
      <path d="M25 213c3-39 24-64 65-64s62 25 65 64" fill={shirtColor} />
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
      <path d="M79 122h22v32H79z" fill="#b88765" />
      <ellipse cx="90" cy="94" rx="39" ry="45" fill="#d3aa83" />
      <path
        d="M52 91c0-37 18-55 42-55 27 0 41 21 38 56-8-15-21-19-34-22-17-4-30 2-46 21Z"
        fill="#382c2a"
      />
      <path d="M70 95h8m24 0h8" stroke="#2b292a" strokeWidth="4" strokeLinecap="round" />
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
      <path d="m48 173 17-11m67 11-17-11" stroke="oklch(1 0 0 / .2)" strokeWidth="2" />
    </svg>
  );
}
