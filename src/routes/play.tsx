import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { TopBar } from "@/components/game/TopBar";
import { MAP_SWATCH, PageShell, Picker } from "@/components/game/Picker";
import { useProgress } from "@/components/game/useProgress";
import { Arena } from "@/components/fps/Arena";
import { MAPS, MAP_IDS, type MapId } from "@/game/sim/maps";
import { DIFFICULTIES, type Difficulty } from "@/game/sim/waves";
import { WEAPONS } from "@/game/sim/weapons";
import { awardWave } from "@/game/progress";

export const Route = createFileRoute("/play")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dungeon Mode — Mexican Standof" },
      { name: "description", content: "Clear five enemy waves, earn credits and experience, and level up your operator." },
      { property: "og:title", content: "Dungeon Mode — Mexican Standof" },
      { property: "og:description", content: "Clear the five-wave dungeon to earn credits, experience, and operator levels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const p = useProgress();
  const [map, setMap] = useState<MapId>("desert");
  const [diff, setDiff] = useState<Difficulty>("easy");
  const [playing, setPlaying] = useState(false);
  const runId = useRef<string | null>(null);

  if (playing) {
    return (
      <Arena
        mode="dungeon"
        map={map}
        difficulty={diff}
        weapon={p.equipped}
        playerName={p.name}
        credits={p.credits}
        level={p.level}
        experience={p.experience}
        equippedShirt={p.equippedShirt}
        equippedHat={p.equippedHat}
        onWaveCleared={async (wave) => {
          const res = await awardWave(map, diff, wave, runId.current);
          runId.current = res.runId;
          return res;
        }}
        onRestart={() => { runId.current = null; }}
        onExit={() => {
          runId.current = null;
          setPlaying(false);
        }}
      />
    );
  }

  return (
    <>
      <TopBar />
      <PageShell title="DUNGEON" kicker="WAVE SURVIVAL">
        <Picker
          label="MAP"
          value={map}
          onChange={setMap}
          options={MAP_IDS.map((id) => ({ id, title: MAPS[id].name, sub: MAPS[id].blurb, swatch: MAP_SWATCH[id] }))}
        />
        <Picker
          label="DIFFICULTY"
          value={diff}
          onChange={setDiff}
          options={(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => ({
            id,
            title: DIFFICULTIES[id].label.toUpperCase(),
            sub: `+${DIFFICULTIES[id].creditsPerWave} credits per wave`,
          }))}
        />
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="mso-btn text-2xl" onClick={() => { runId.current = null; setPlaying(true); }}>
            DEPLOY ▸
          </button>
          <span className="font-bold text-muted-foreground">Carrying: {WEAPONS[p.equipped].name}</span>
        </div>
      </PageShell>
    </>
  );
}
