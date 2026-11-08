import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/game/TopBar";
import { MAP_SWATCH, PageShell } from "@/components/game/Picker";
import { MAPS, MAP_IDS } from "@/game/sim/maps";

export const Route = createFileRoute("/maps")({
  head: () => ({
    meta: [
      { title: "Maps — Mexican Standof" },
      { name: "description", content: "Three arenas: Desert Dunes, Neon Night and Frozen Base. Playable in Dungeon, Training, Co-op and 1v1." },
      { property: "og:title", content: "Maps — Mexican Standof" },
      { property: "og:description", content: "Desert Dunes, Neon Night and Frozen Base." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapsPage,
});

function MapsPage() {
  return (
    <>
      <TopBar />
      <PageShell title="MAPS" kicker="ARENAS">
        <div className="grid gap-5 md:grid-cols-3">
          {MAP_IDS.map((id) => (
            <div key={id} className="mso-card overflow-hidden">
              <div className="h-40 border-b-[3px] border-[var(--mso-ink)]" style={{ background: MAP_SWATCH[id] }} />
              <div className="p-5">
                <div className="mso-display text-3xl">{MAPS[id].name}</div>
                <p className="text-muted-foreground">{MAPS[id].blurb}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/play" className="mso-btn">PLAY DUNGEON</Link>
          <Link to="/co-op" className="mso-btn mso-btn-ghost">PLAY WITH A FRIEND</Link>
        </div>
      </PageShell>
    </>
  );
}
