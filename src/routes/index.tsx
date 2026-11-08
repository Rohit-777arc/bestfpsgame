import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/game/TopBar";
import { useProgress } from "@/components/game/useProgress";
import { WEAPONS } from "@/game/sim/weapons";
import { DIFFICULTIES } from "@/game/sim/waves";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mexican Standof — Browser FPS: Dungeons, Duels & Aim Training" },
      { name: "description", content: "Fight enemy waves for credits, unlock 5 weapons, train your aim, and 1v1 your friends with a room code. Free in your browser." },
      { property: "og:title", content: "Mexican Standof — Browser FPS" },
      { property: "og:description", content: "Wave dungeons, a weapon armory, aim training and friend duels — in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Hub,
});

const MODES = [
  { to: "/play", title: "DUNGEON", sub: "Survive waves. Earn credits.", tag: "EARN", color: "var(--primary)" },
  { to: "/co-op", title: "CO-OP & 1v1", sub: "Room code. Team up or duel a friend.", tag: "ONLINE", color: "var(--mso-ally)" },
  { to: "/train", title: "TRAINING", sub: "Moving dummies. Sharpen your aim.", tag: "PRACTICE", color: "var(--accent)" },
] as const;

function Hub() {
  const p = useProgress();
  const eq = WEAPONS[p.equipped];
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <section className="flex flex-col items-start gap-4">
          <div className="mso-chip"><span className="mso-chip-label">SEASON 1</span> 3 maps · 5 weapons</div>
          <h1 className="mso-banner text-6xl sm:text-8xl">MEXICAN<br />STANDOF</h1>
          <p className="max-w-xl text-lg font-semibold text-muted-foreground">
            Clear dungeon waves for credits — {DIFFICULTIES.easy.creditsPerWave} on Easy, {DIFFICULTIES.normal.creditsPerWave} on Normal,{" "}
            {DIFFICULTIES.hard.creditsPerWave} on Hard — spend them in the Armory, then call out a friend.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/play" className="mso-btn">PLAY NOW</Link>
            <Link to="/armory" className="mso-btn mso-btn-ghost">ARMORY</Link>
          </div>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          {MODES.map((m) => (
            <Link key={m.to} to={m.to} className="mso-card group relative overflow-hidden p-6">
              <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-30" style={{ background: m.color }} />
              <div className="mso-chip mb-6 text-xs"><span style={{ color: m.color }} className="mso-display">{m.tag}</span></div>
              <div className="mso-display text-4xl">{m.title}</div>
              <div className="mt-1 font-semibold text-muted-foreground">{m.sub}</div>
              <div className="mso-display mt-6 text-lg" style={{ color: m.color }}>GO ▸</div>
            </Link>
          ))}
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <Link to="/armory" className="mso-card flex items-center justify-between p-6">
            <div>
              <div className="text-sm font-bold text-muted-foreground">EQUIPPED</div>
              <div className="mso-display text-3xl">{eq.name}</div>
              <div className="text-sm text-muted-foreground">{eq.desc}</div>
            </div>
            <span className="mso-display text-primary">CHANGE ▸</span>
          </Link>
          <Link to="/maps" className="mso-card flex items-center justify-between p-6">
            <div>
              <div className="text-sm font-bold text-muted-foreground">MAPS</div>
              <div className="mso-display text-3xl">Desert · Neon · Frozen</div>
              <div className="text-sm text-muted-foreground">Pick any map in every mode.</div>
            </div>
            <span className="mso-display text-primary">VIEW ▸</span>
          </Link>
        </section>
      </main>
    </>
  );
}
