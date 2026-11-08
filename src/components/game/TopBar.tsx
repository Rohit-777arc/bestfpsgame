import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useProgress } from "./useProgress";
import { AccountDialog } from "./AccountDialog";
import { signOut } from "@/game/progress";

const NAV = [
  { to: "/play", label: "Dungeon" },
  { to: "/train", label: "Training" },
  { to: "/co-op", label: "Co-op & 1v1" },
  { to: "/armory", label: "Armory" },
  { to: "/maps", label: "Maps" },
] as const;

export function TopBar() {
  const p = useProgress();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-[var(--mso-ink)] bg-[var(--mso-panel)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link to="/" className="mso-display text-2xl text-primary">
          MEXICAN STANDOF
        </Link>
        <nav className="flex flex-wrap gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-lg px-3 py-1.5 font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="mso-chip">
            <span className="mso-coin" />
            <span className="mso-num">{p.kind === "loading" ? "…" : p.credits}</span>
          </div>
          <button type="button" className="mso-chip hover:bg-secondary" onClick={() => setOpen(true)}>
            {p.kind === "account" ? "👤" : "🎮"} {p.kind === "loading" ? "…" : p.name}
          </button>
          {p.kind === "account" && (
            <button type="button" className="text-sm font-bold text-muted-foreground hover:text-foreground" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </div>
      </div>
      <AccountDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
