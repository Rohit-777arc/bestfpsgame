import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { TopBar } from "@/components/game/TopBar";
import { useProgress } from "@/components/game/useProgress";
import { WEAPONS } from "@/game/sim/weapons";
import { DIFFICULTIES } from "@/game/sim/waves";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mexican Standof — Browser FPS: Dungeons, Duels & Aim Training" },
      {
        name: "description",
        content:
          "Fight enemy waves for credits, unlock 5 weapons, train your aim, and 1v1 your friends with a room code. Free in your browser.",
      },
      { property: "og:title", content: "Mexican Standof — Browser FPS" },
      {
        property: "og:description",
        content: "Wave dungeons, a weapon armory, aim training and friend duels — in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Hub,
});

const MODES = [
  {
    to: "/play",
    title: "DUNGEON",
    sub: "Survive waves. Earn credits.",
    tag: "EARN",
    color: "var(--primary)",
  },
  {
    to: "/co-op",
    title: "CO-OP & 1v1",
    sub: "Room code. Team up or duel a friend.",
    tag: "ONLINE",
    color: "var(--mso-ally)",
  },
  {
    to: "/train",
    title: "TRAINING",
    sub: "Moving dummies. Sharpen your aim.",
    tag: "PRACTICE",
    color: "var(--accent)",
  },
] as const;

function Hub() {
  const p = useProgress();
  const eq = WEAPONS[p.equipped];
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <section className="hub-hero relative overflow-hidden">
          <div className="hub-hero-copy">
            <div className="hub-eyebrow">
              <span className="hub-live-dot" /> SEASON 01 <span className="hub-eyebrow-divider" /> 3
              MAPS · 5 WEAPONS
            </div>
            <h1 className="hub-title">
              MEXICAN
              <br />
              <span>STANDOF</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Clear dungeon waves for credits — {DIFFICULTIES.easy.creditsPerWave} on Easy,{" "}
              {DIFFICULTIES.normal.creditsPerWave} on Normal, {DIFFICULTIES.hard.creditsPerWave} on
              Hard. Gear up in the Armory, then call out a friend.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link to="/play" className="mso-btn hub-primary-action">
                <span>DEPLOY</span>
                <span aria-hidden="true">↗</span>
              </Link>
              <Link to="/armory" className="mso-btn mso-btn-ghost">
                OPEN ARMORY
              </Link>
            </div>
          </div>
          <div className="hub-hero-art" aria-hidden="true">
            <div className="hub-reticle">
              <span />
              <i />
              <b />
            </div>
            <div className="hub-art-label">
              <span>FIELD OPS</span>
              <strong>READY</strong>
            </div>
            <div className="hub-coordinate">MX / 01—07</div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Game modes">
          {MODES.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="mso-card hub-mode-card group"
              style={{ "--mode-color": m.color } as CSSProperties}
            >
              <div className="hub-mode-top">
                <span className="hub-mode-tag">{m.tag}</span>
                <span className="hub-mode-arrow" aria-hidden="true">
                  ↗
                </span>
              </div>
              <div className="mso-display mt-8 text-3xl">{m.title}</div>
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.sub}</div>
              <div className="hub-mode-rule" />
              <div className="hub-mode-cta">
                ENTER MODE <span aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2" aria-label="Loadout and maps">
          <Link to="/armory" className="mso-card hub-info-card">
            <div>
              <div className="hub-info-kicker">CURRENT LOADOUT</div>
              <div className="mso-display text-3xl">{eq.name}</div>
              <div className="text-sm text-muted-foreground">{eq.desc}</div>
            </div>
            <span className="hub-info-link">
              EDIT LOADOUT <span aria-hidden="true">→</span>
            </span>
          </Link>
          <Link to="/maps" className="mso-card hub-info-card">
            <div>
              <div className="hub-info-kicker">DEPLOYMENT ZONES</div>
              <div className="mso-display text-3xl">Desert · Neon · Frozen</div>
              <div className="text-sm text-muted-foreground">Pick any map in every mode.</div>
            </div>
            <span className="hub-info-link">
              VIEW MAPS <span aria-hidden="true">→</span>
            </span>
          </Link>
        </section>
      </main>
    </>
  );
}
