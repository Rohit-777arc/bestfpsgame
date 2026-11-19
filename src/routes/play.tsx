import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/game/TopBar";
import { MAP_SWATCH, PageShell, Picker } from "@/components/game/Picker";
import { useProgress } from "@/components/game/useProgress";
import { Arena } from "@/components/fps/Arena";
import { MAPS, MAP_IDS, type MapId } from "@/game/sim/maps";
import { DIFFICULTIES, type Difficulty, type DungeonVariant } from "@/game/sim/waves";
import { WEAPONS } from "@/game/sim/weapons";
import { ARMOUR_REDUCTION } from "@/game/sim/cosmetics";
import {
  awardDungeonLoot,
  awardWave,
  collectExperience,
  dropHotbarItem,
  findEnchantingBook,
  recordSessionStats,
  selectHotbarSlot,
} from "@/game/progress";

export const Route = createFileRoute("/play")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dungeon Mode — Mexican Standof" },
      { name: "description", content: "Fight five gunfight waves or explore endless underground rooms. Earn coins and experience." },
      { property: "og:title", content: "Dungeon Mode — Mexican Standof" },
      { property: "og:description", content: "Fight five gunfight waves or survive endless underground rooms." },
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
  const [dungeonVariant, setDungeonVariant] = useState<DungeonVariant>("gunfight");
  const [playing, setPlaying] = useState(false);
  const [equippedKnife, setEquippedKnife] = useState<string | null>(p.loot.crafted.find((id) => id.includes("sword")) ?? null);
  const runId = useRef<string | null>(null);

  if (playing) {
    return (
      <Arena
        mode="dungeon"
        dungeonVariant={dungeonVariant}
        map={map}
        difficulty={diff}
        weapon={p.equipped}
        playerName={p.name}
        credits={p.credits}
        hotbar={p.loot.hotbar}
        ownedSwords={p.loot.crafted.filter((id) => id.includes("sword"))}
        equippedKnife={equippedKnife}
        onEquipKnife={setEquippedKnife}
        onSelectHotbarSlot={selectHotbarSlot}
        onDropHotbarItem={dropHotbarItem}
        level={p.level}
        experience={p.experience}
        equippedShirt={p.equippedShirt}
        equippedHat={p.equippedHat}
        equippedPants={p.equippedPants}
        equippedBoots={p.equippedBoots}
        equippedWeaponSkin={p.equippedWeaponSkin}
        avatarColors={p.avatarCustomizationUnlocked ? p.avatarColors : undefined}
        armourReduction={ARMOUR_REDUCTION[p.equippedShirt ?? ""] ?? 0}
        onWaveCleared={async (wave) => {
          const res = await awardWave(map, diff, wave, runId.current, "dungeon", dungeonVariant);
          runId.current = res.runId;
          return res;
        }}
        onExperienceCollected={collectExperience}
        onDungeonKill={(tier) => {
          const drop = awardDungeonLoot(tier);
          const lootText = Object.entries(drop.materials)
            .filter(([, amount]) => amount)
            .map(([material, amount]) => `${amount} ${material}`)
            .join(", ");
          if (drop.shard) toast.success("ENCHANTING SHARD FOUND");
          else if (drop.book) toast.success("ENCHANTING BOOK FOUND");
          else if (lootText) toast.success(`Dungeon loot: ${lootText}`);
          if (drop.inventoryFull) toast.error("Inventory full; some loot could not be collected");
        }}
        onBookFound={() => {
          const found = findEnchantingBook();
          if (found) toast.success("Enchanting book found in the room");
          else toast.error("Your hotbar and bundle are full");
          return found;
        }}
        onRestart={() => { runId.current = null; }}
        onExit={async (stats) => {
          try {
            await recordSessionStats(stats);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save your player stats");
          }
          runId.current = null;
          setPlaying(false);
        }}
      />
    );
  }

  return (
    <>
      <TopBar />
      <PageShell title="DUNGEON" kicker="CHOOSE YOUR DESCENT">
        <Picker
          label="DUNGEON MODE"
          value={dungeonVariant}
          onChange={setDungeonVariant}
          options={[
            { id: "gunfight", title: "GUNFIGHT", sub: "Five waves of armed enemies. Hold the arena and fight back." },
            { id: "underground", title: "UNDERGROUND", sub: "Endless abandoned rooms. Clear the zombies, then enter the open doorway to descend." },
          ]}
        />
        {dungeonVariant === "gunfight" && (
          <Picker
            label="MAP"
            value={map}
            onChange={setMap}
            options={MAP_IDS.map((id) => ({ id, title: MAPS[id].name, sub: MAPS[id].blurb, swatch: MAP_SWATCH[id] }))}
          />
        )}
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
        {dungeonVariant === "underground" && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            Survive as many rooms as you can. Clear each chamber to open its doors, then follow the stairs deeper underground. Enchanting books are rare finds.
            Keep your distance: their only attack is up close.
          </p>
        )}
      </PageShell>
    </>
  );
}
