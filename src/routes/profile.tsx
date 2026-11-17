import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CharacterPreview } from "@/components/game/CharacterPreview";
import { ExperienceBar } from "@/components/game/ExperienceBar";
import { PageShell } from "@/components/game/Picker";
import { TopBar } from "@/components/game/TopBar";
import { useProgress } from "@/components/game/useProgress";
import { buyCosmetic, setEquippedCosmetic } from "@/game/progress";
import { COSMETICS, type CosmeticId, type CosmeticSlot } from "@/game/sim/cosmetics";
import { experienceRequiredForLevel } from "@/game/sim/progression";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Player Profile — Mexican Standof" },
      {
        name: "description",
        content: "View your player level and customize your character with earned credits.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const progress = useProgress();
  const [slot, setSlot] = useState<CosmeticSlot>("shirt");
  const [busy, setBusy] = useState<string | null>(null);

  async function purchase(id: CosmeticId) {
    setBusy(id);
    try {
      await buyCosmetic(id);
      toast.success("Cosmetic purchased");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not purchase cosmetic");
    } finally {
      setBusy(null);
    }
  }

  async function equip(itemSlot: CosmeticSlot, id: CosmeticId | null) {
    setBusy(id ?? `unequip-${itemSlot}`);
    try {
      await setEquippedCosmetic(itemSlot, id);
      toast.success(id ? "Cosmetic equipped" : "Cosmetic unequipped");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not equip cosmetic");
    } finally {
      setBusy(null);
    }
  }

  const equippedBySlot = {
    shirt: progress.equippedShirt,
    hat: progress.equippedHat,
  };

  return (
    <>
      <TopBar />
      <PageShell title="PLAYER PROFILE" kicker="OPERATOR">
        <div className="profile-customization-layout">
          <section className="profile-summary mso-panel">
            <div className="profile-operator-preview">
              <CharacterPreview shirtId={progress.equippedShirt} hatId={progress.equippedHat} />
            </div>
            <div className="hub-info-kicker mt-6">ACTIVE OPERATOR</div>
            <h2 className="mso-display mt-2 text-4xl">{progress.name}</h2>
            <div className="profile-stats">
              <div>
                <span>LEVEL</span>
                <strong>{progress.level}</strong>
              </div>
              <div>
                <span>EXPERIENCE</span>
                <strong>
                  {progress.experience} / {experienceRequiredForLevel(progress.level)} EXP
                </strong>
              </div>
              <div>
                <span>DUNGEONS CLEARED</span>
                <strong>{progress.dungeonsCompleted}</strong>
              </div>
              <div>
                <span>IN-GAME COINS</span>
                <strong>{progress.credits} ¢</strong>
              </div>
            </div>
            <ExperienceBar level={progress.level} experience={progress.experience} />
          </section>

          <section className="profile-shop mso-panel" id="customization-shop">
            <div className="profile-shop-header">
              <CharacterPreview
                compact
                shirtId={progress.equippedShirt}
                hatId={progress.equippedHat}
              />
              <div>
                <div className="hub-info-kicker">CUSTOMIZATION SHOP</div>
                <h2 className="mso-display mt-1 text-3xl">MAKE IT YOURS</h2>
                <p className="text-sm text-muted-foreground">
                  Your equipped outfit appears in your gameplay HUD.
                </p>
              </div>
              <div className="mso-chip">
                <span className="mso-coin" />
                {progress.credits}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {(["shirt", "hat"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`mso-btn ${slot === value ? "" : "mso-btn-ghost"}`}
                  aria-pressed={slot === value}
                  onClick={() => setSlot(value)}
                >
                  {value === "shirt" ? "SHIRTS & OUTFITS" : "HEADWEAR"}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {COSMETICS.filter((item) => item.slot === slot).map((item) => {
                const owned = progress.cosmetics.includes(item.id);
                const equipped = equippedBySlot[item.slot] === item.id;
                const insufficient = !owned && progress.credits < item.price;
                return (
                  <article
                    key={item.id}
                    className={`mso-card flex flex-col gap-4 p-5 ${equipped ? "mso-sel" : ""}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="cosmetic-swatch"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      >
                        {item.slot === "hat" ? "⌃" : "✦"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="mso-display text-xl">{item.name}</h3>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          {item.slot} · {item.style}
                        </p>
                      </div>
                      <div
                        className={`mso-chip text-sm ${equipped ? "cosmetic-equipped-badge" : ""}`}
                      >
                        {equipped ? (
                          "EQUIPPED"
                        ) : owned ? (
                          "OWNED"
                        ) : (
                          <>
                            <span className="mso-coin" />
                            {item.price}
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`mso-btn mt-auto ${owned ? "mso-btn-ghost" : ""}`}
                      disabled={
                        busy !== null ||
                        progress.kind === "loading" ||
                        equipped ||
                        (!owned && insufficient)
                      }
                      onClick={() =>
                        owned ? void equip(item.slot, item.id) : void purchase(item.id)
                      }
                    >
                      {equipped
                        ? "EQUIPPED"
                        : owned
                          ? "EQUIP"
                          : insufficient
                            ? `NEED ${item.price - progress.credits} MORE`
                            : "BUY"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </PageShell>
    </>
  );
}
