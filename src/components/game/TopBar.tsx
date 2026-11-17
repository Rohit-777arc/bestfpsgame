import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useProgress } from "./useProgress";
import { AccountDialog } from "./AccountDialog";
import { signOut } from "@/game/progress";

const NAV = [
  { to: "/play", label: "Dungeon" },
  { to: "/profile", label: "Profile" },
  { to: "/train", label: "Training" },
  { to: "/co-op", label: "Co-op & 1v1" },
  { to: "/armory", label: "Armory" },
  { to: "/maps", label: "Maps" },
] as const;

export function TopBar() {
  const p = useProgress();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
        <Link to="/" className="site-brand">
          <span className="site-brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            MEXICAN <b>STANDOF</b>
          </span>
        </Link>
        <nav className="site-nav flex flex-wrap gap-1" aria-label="Main navigation">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="site-nav-link"
              activeProps={{ className: "site-nav-link site-nav-active" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="site-credit">
            <span className="site-credit-icon" aria-hidden="true">
              ¢
            </span>
            <span className="mso-num">{p.kind === "loading" ? "…" : p.credits}</span>
          </div>
          <button type="button" className="site-account" onClick={() => setOpen(true)}>
            <span className="site-account-avatar" aria-hidden="true">
              {(p.kind === "loading" ? "…" : p.name).slice(0, 1).toUpperCase()}
            </span>
            <span className="site-account-name">{p.kind === "loading" ? "…" : p.name}</span>
          </button>
          {p.kind === "account" && (
            <button
              type="button"
              className="text-sm font-bold text-muted-foreground hover:text-foreground"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
      <AccountDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
