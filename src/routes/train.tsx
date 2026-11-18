import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/game/TopBar";
import { MAP_SWATCH, PageShell, Picker } from "@/components/game/Picker";
import { useProgress } from "@/components/game/useProgress";
import { Arena } from "@/components/fps/Arena";
import { MAPS, MAP_IDS, type MapId } from "@/game/sim/maps";
import { dropHotbarItem, recordSessionStats, selectHotbarSlot } from "@/game/progress";

export const Route = createFileRoute("/train")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aim Training — Mexican Standof" },
      { name: "description", content: "Practice on moving dummies with five speed levels. 60-second drills track your hits and accuracy." },
      { property: "og:title", content: "Aim Training — Mexican Standof" },
      { property: "og:description", content: "Sharpen your aim on moving dummies — no credits at risk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainPage,
});

const LEVELS = ["Chill", "Steady", "Quick", "Fast", "Insane"];

function TrainPage() {
  const p = useProgress();
  const [map, setMap] = useState<MapId>("desert");
  const [level, setLevel] = useState(2);
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <Arena
        mode="train"
        map={map}
        difficulty="easy"
        trainLevel={level}
        weapon={p.equipped}
        playerName={p.name}
        credits={p.credits}
        hotbar={p.loot.hotbar}
        onSelectHotbarSlot={selectHotbarSlot}
        onDropHotbarItem={dropHotbarItem}
        level={p.level}
        experience={p.experience}
        equippedShirt={p.equippedShirt}
        equippedHat={p.equippedHat}
        equippedPants={p.equippedPants}
        equippedBoots={p.equippedBoots}
        onExit={async (stats) => {
          try {
            await recordSessionStats(stats);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save your player stats");
          }
          setPlaying(false);
        }}
      />
    );
  }

  return (
    <>
      <TopBar />
      <PageShell title="TRAINING" kicker="AIM DRILLS">
        <Picker
          label="MAP"
          value={map}
          onChange={setMap}
          options={MAP_IDS.map((id) => ({ id, title: MAPS[id].name, swatch: MAP_SWATCH[id] }))}
        />
        <section>
          <h3 className="mso-display mb-2 text-xl text-primary">DUMMY SPEED</h3>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l, i) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(i + 1)}
                className={`mso-card px-5 py-3 ${level === i + 1 ? "mso-sel" : ""}`}
              >
                <div className="mso-display text-2xl">{i + 1}</div>
                <div className="text-sm font-bold text-muted-foreground">{l}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">60-second drill. Every dummy drops in one hit — speed and count rise with the level.</p>
        </section>
        <div>
          <button type="button" className="mso-btn text-2xl" onClick={() => setPlaying(true)}>START DRILL ▸</button>
        </div>
      </PageShell>
    </>
  );
}
