import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/game/TopBar";
import { PageShell } from "@/components/game/Picker";
import { useProgress } from "@/components/game/useProgress";
import { CharacterPreview } from "@/components/game/CharacterPreview";
import { WEAPONS, WEAPON_IDS, shotInterval, type WeaponId } from "@/game/sim/weapons";
import {
  buyCosmetic,
  buyWeapon,
  setEquipped,
  setEquippedCosmetic,
  craftDungeonItem,
  enchantDungeonItem,
} from "@/game/progress";
import { COSMETICS, type CosmeticId } from "@/game/sim/cosmetics";
import { canCraft, canEnchant, CRAFTING_RECIPES, ENCHANTMENTS } from "@/game/sim/dungeonLoot";

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
  const [busyArmor, setBusyArmor] = useState<CosmeticId | null>(null);
  const [section, setSection] = useState<"weapons" | "armor" | "crafting" | "enchanting">(
    "weapons",
  );
  const [busyLoot, setBusyLoot] = useState<string | null>(null);
  const equippedBySlot = {
    shirt: p.equippedShirt,
    hat: p.equippedHat,
    pants: p.equippedPants,
    boots: p.equippedBoots,
  };

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

  async function actArmor(id: CosmeticId) {
    const item = COSMETICS.find((cosmetic) => cosmetic.id === id);
    if (!item) return;
    setBusyArmor(id);
    try {
      if (p.cosmetics.includes(id)) {
        await setEquippedCosmetic(item.slot, id);
        toast.success(`${item.name} equipped`);
      } else {
        await buyCosmetic(id);
        await setEquippedCosmetic(item.slot, id);
        toast.success(`${item.name} unlocked and equipped`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not equip armor");
    } finally {
      setBusyArmor(null);
    }
  }

  async function craft(recipeId: string) {
    setBusyLoot(recipeId);
    try {
      await craftDungeonItem(recipeId);
      toast.success("Item crafted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not craft item");
    } finally {
      setBusyLoot(null);
    }
  }

  function enchant(itemId: string, enchantmentId: string) {
    const key = `${itemId}:${enchantmentId}`;
    setBusyLoot(key);
    try {
      enchantDungeonItem(itemId, enchantmentId);
      toast.success("Enchantment applied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enchant item");
    } finally {
      setBusyLoot(null);
    }
  }

  return (
    <>
      <TopBar />
      <PageShell title="ARMORY" kicker="LOADOUT & ARMOR">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Armory sections">
          <button type="button" className={`mso-btn ${section === "weapons" ? "" : "mso-btn-ghost"}`} role="tab" aria-selected={section === "weapons"} onClick={() => setSection("weapons")}>WEAPONS</button>
          <button type="button" className={`mso-btn ${section === "armor" ? "" : "mso-btn-ghost"}`} role="tab" aria-selected={section === "armor"} onClick={() => setSection("armor")}>ARMOR & OUTFITS</button>
          <button
            type="button"
            className={`mso-btn ${section === "crafting" ? "" : "mso-btn-ghost"}`}
            role="tab"
            aria-selected={section === "crafting"}
            onClick={() => setSection("crafting")}
          >
            CRAFTING
          </button>
          <button
            type="button"
            className={`mso-btn ${section === "enchanting" ? "" : "mso-btn-ghost"}`}
            role="tab"
            aria-selected={section === "enchanting"}
            onClick={() => setSection("enchanting")}
          >
            ENCHANTING
          </button>
        </div>
        {section === "weapons" ? (
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
        ) : section === "armor" ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {COSMETICS.filter((item) => item.slot !== "hat").map((item) => {
              const owned = p.cosmetics.includes(item.id);
              const equipped = equippedBySlot[item.slot] === item.id;
              const short = !owned && p.credits < item.price;
              return (
                <article key={item.id} className={`mso-card flex flex-col gap-4 p-5 ${equipped ? "mso-sel" : ""}`}>
                  <div className="flex items-start gap-4">
                    <CharacterPreview
                      compact
                      shirtId={item.slot === "shirt" ? item.id : p.equippedShirt}
                      pantsId={item.slot === "pants" ? item.id : p.equippedPants}
                      bootsId={item.slot === "boots" ? item.id : p.equippedBoots}
                      hatId={p.equippedHat}
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="mso-display text-xl">{item.name}</h2>
                      <p className="text-sm text-muted-foreground">Protective look · {item.style}</p>
                    </div>
                    <div className="mso-chip text-sm">
                      {owned ? (equipped ? "EQUIPPED" : "OWNED") : <><span className="mso-coin" />{item.price}</>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Character armor appearance. Your selected outfit is saved to your profile.</p>
                  <button
                    type="button"
                    className={`mso-btn mt-auto ${owned ? "mso-btn-ghost" : ""}`}
                    disabled={equipped || short || busyArmor !== null || p.kind === "loading"}
                    onClick={() => void actArmor(item.id)}
                  >
                    {equipped ? "EQUIPPED" : owned ? "EQUIP" : short ? `NEED ${item.price - p.credits} MORE` : "BUY & EQUIP"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : section === "crafting" ? (
          <section className="grid gap-5 sm:grid-cols-2">
            {CRAFTING_RECIPES.map((recipe) => {
              const owned = p.loot.crafted.includes(recipe.id);
              const materials = Object.entries(recipe.materials)
                .map(
                  ([material, amount]) =>
                    `${p.loot.materials[material as keyof typeof p.loot.materials]}/${amount} ${material}`,
                )
                .join(" · ");
              return (
                <article key={recipe.id} className="mso-card flex flex-col gap-3 p-5">
                  <div className="mso-display text-2xl">{recipe.name}</div>
                  <p className="text-sm text-muted-foreground">{materials}</p>
                  <div className="mso-chip w-fit">
                    <span className="mso-coin" />
                    {recipe.fee} CRAFTING FEE
                  </div>
                  <button
                    type="button"
                    className="mso-btn mt-auto"
                    disabled={
                      p.kind === "loading" ||
                      owned ||
                      busyLoot !== null ||
                      !canCraft(p.loot, recipe.id, p.credits)
                    }
                    onClick={() => void craft(recipe.id)}
                  >
                    {owned ? "CRAFTED" : `CRAFT · ${recipe.fee} COINS`}
                  </button>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="space-y-5">
            <div className="mso-panel flex flex-wrap gap-4 text-sm">
              <span>
                BOOKS: <b>{p.loot.books}</b>
              </span>
              <span>
                ENCHANTING SHARDS: <b>{p.loot.shards}</b>
              </span>
              <span className="text-muted-foreground">
                Find books in dungeon furnishings; defeat the rare Enchanter for a shard.
              </span>
            </div>
            {p.loot.crafted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Craft a sword or armor piece first to enchant it.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {p.loot.crafted.flatMap((itemId) =>
                  ENCHANTMENTS.map((enchantment) => {
                    const done = p.loot.enchanted.includes(`${itemId}:${enchantment.id}`);
                    const ready = canEnchant(p.loot, itemId, enchantment.id);
                    return (
                      <article
                        key={`${itemId}:${enchantment.id}`}
                        className="mso-card flex flex-col gap-3 p-5"
                      >
                        <div className="mso-display text-xl">
                          {itemId.replaceAll("-", " ")} · {enchantment.name}
                        </div>
                        <p className="text-sm text-muted-foreground">{enchantment.description}</p>
                        <button
                          type="button"
                          className="mso-btn mt-auto"
                          disabled={done || !ready || busyLoot !== null}
                          onClick={() => enchant(itemId, enchantment.id)}
                        >
                          {done ? "ENCHANTED" : "USE BOOK + SHARD"}
                        </button>
                      </article>
                    );
                  }),
                )}
              </div>
            )}
          </section>
        )}
      </PageShell>
    </>
  );
}
