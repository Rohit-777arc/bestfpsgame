import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/game/TopBar";
import { PageShell } from "@/components/game/Picker";
import { useProgress } from "@/components/game/useProgress";
import { WEAPONS, WEAPON_IDS, shotInterval, type WeaponId } from "@/game/sim/weapons";
import { buyWeapon, setEquipped } from "@/game/progress";

export const Route = createFileRoute("/armory")({
  head: () => ({
    meta: [
      { title: "Armory — Mexican Standof Weapons" },
      { name: "description", content: "Spend dungeon credits on 5 weapons: Scout Pistol, Vector SMG, Riot Shotgun, Marksman Rifle and Longbow Sniper." },
      { property: "og:title", content: "Armory — Mexican Standof" },
      { property: "og:description", content: "Unlock and equip five weapons with the credits you earn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArmoryPage,
});

function Stat({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-muted-foreground"><span>{label}</span></div>
      <div className="mso-bar mt-0.5 h-2.5">
        <div className="mso-bar-fill bg-primary" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function ArmoryPage() {
  const p = useProgress();
  const [busy, setBusy] = useState<WeaponId | null>(null);

  async function act(id: WeaponId) {
    setBusy(id);
    try {
      if (p.weapons.includes(id)) {
        await setEquipped(id);
        toast.success(`${WEAPONS[id].name} equipped`);
      } else {
        await buyWeapon(id);
        await setEquipped(id);
        toast.success(`${WEAPONS[id].name} unlocked!`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not do that");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <TopBar />
      <PageShell title="ARMORY" kicker="WEAPONS">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WEAPON_IDS.map((id) => {
            const w = WEAPONS[id];
            const owned = p.weapons.includes(id);
            const equipped = p.equipped === id;
            const short = !owned && p.credits < w.price;
            return (
              <div key={id} className={`mso-card flex flex-col gap-3 p-5 ${equipped ? "mso-sel" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="mso-display text-2xl">{w.name}</div>
                  <div className="mso-chip text-sm">
                    {w.price === 0 ? "FREE" : <><span className="mso-coin" />{w.price}</>}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{w.desc}</p>
                <div className="flex flex-col gap-2">
                  <Stat label="DAMAGE" value={w.damage * w.pellets} max={150} />
                  <Stat label="FIRE RATE" value={1 / shotInterval(w)} max={15} />
                  <Stat label="MAGAZINE" value={w.mag} max={30} />
                  <Stat label="ACCURACY" value={0.1 - w.spread} max={0.1} />
                </div>
                <button
                  type="button"
                  className={`mso-btn mt-auto ${owned ? "mso-btn-ghost" : ""}`}
                  disabled={equipped || short || busy !== null || p.kind === "loading"}
                  onClick={() => void act(id)}
                >
                  {equipped ? "EQUIPPED" : owned ? "EQUIP" : short ? `NEED ${w.price - p.credits} MORE` : "BUY & EQUIP"}
                </button>
              </div>
            );
          })}
        </div>
      </PageShell>
    </>
  );
}
