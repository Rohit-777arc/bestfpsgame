import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { TopBar } from "@/components/game/TopBar";
import { useProgress } from "@/components/game/useProgress";
import { WEAPONS } from "@/game/sim/weapons";
import { DIFFICULTIES } from "@/game/sim/waves";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mexican Standof — Browser FPS: Dungeons, Duels & Arcade Modes" },
      {
        name: "description",
        content:
          "Clear dungeon waves, customize your operator, unlock weapons, race cars and bikes, train your aim, and duel friends. Free in your browser.",
      },
      { property: "og:title", content: "Mexican Standof — Browser FPS & Arcade Playground" },
      {
        property: "og:description",
        content: "Five-wave dungeons, operator profiles and cosmetics, a weapon armory, aim training, friend duels and road challenges.",
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
  {
    to: "/vehicles",
    title: "VEHICLES",
    sub: "Street cars and motorbikes.",
    tag: "NEW",
    color: "var(--primary)",
  },
  {
    to: "/cooking",
    title: "COOK-OFF",
    sub: "Grab ingredients. Cook fast. Serve the crowd.",
    tag: "CHAOS",
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
              Clear five dungeon waves for credits and XP — {DIFFICULTIES.easy.creditsPerWave} credits per wave on Easy,{" "}
              {DIFFICULTIES.normal.creditsPerWave} on Normal, {DIFFICULTIES.hard.creditsPerWave} on
              Hard. Gear up in the Armory, then call out a friend.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link to="/play" className="mso-btn hub-primary-action">
                <span>DEPLOY</span>
                <span aria-hidden="true">↗</span>
              </Link>
              <Link to="/profile" className="mso-btn mso-btn-ghost">
                PLAYER PROFILE
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
          {p.racingUnlocked && (
            <Link
              to="/racing"
              className="mso-card hub-mode-card group"
              style={{ "--mode-color": "var(--mso-foe)" } as CSSProperties}
            >
              <div className="hub-mode-top">
                <span className="hub-mode-tag">ARCADE</span>
                <span className="hub-mode-arrow" aria-hidden="true">↗</span>
              </div>
              <div className="mso-display mt-8 text-3xl">GUN RACING</div>
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Drift, boost and take down rival cars.
              </div>
              <div className="hub-mode-rule" />
              <div className="hub-mode-cta">ENTER MODE <span aria-hidden="true">→</span></div>
            </Link>
          )}
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
