import { createFileRoute } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
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
  equipWeaponSkin,
  openWeaponCrate as openWeaponCrateFromProgress,
  redeemCode,
  spinLottery,
} from "@/game/progress";
import { ARMOUR_REDUCTION, COSMETICS, type CosmeticId } from "@/game/sim/cosmetics";
import { canCraft, canEnchant, CRAFTING_RECIPES, ENCHANTMENTS } from "@/game/sim/dungeonLoot";
import {
  getWeaponSkin,
  LOTTERY_PRICE,
  WEAPON_CRATES,
  WEAPON_SKINS,
  type WeaponSkinId,
  type WeaponSkinRarity,
} from "@/game/sim/gacha";

export const Route = createFileRoute("/armory")({
  head: () => ({
    meta: [
      { title: "Armory — Mexican Standof Weapons" },
      { name: "description", content: "Unlock weapons, roll the coin lottery, and open seven tiers of animated weapon-skin crates." },
      { property: "og:title", content: "Armory — Mexican Standof" },
      { property: "og:description", content: "Unlock weapons, roll the coin lottery, and collect weapon skins from crates." },
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
  const [section, setSection] = useState<"weapons" | "armor" | "workshop" | "crates" | "codes">(
    "weapons",
  );
  const [busyLoot, setBusyLoot] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [portalItem, setPortalItem] = useState<string | null>(null);
  const [rolling, setRolling] = useState<WeaponSkinRarity | "lottery" | null>(null);
  const [crateBusy, setCrateBusy] = useState<WeaponSkinRarity | null>(null);
  const [skinBusy, setSkinBusy] = useState<WeaponSkinId | "unequip" | null>(null);
  const [reveal, setReveal] = useState<{
    name: string;
    color: string;
    rarity: WeaponSkinRarity;
    refunded: boolean;
  } | null>(null);
  const [lotteryPrize, setLotteryPrize] = useState<number | null>(null);
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
      setPortalItem(`${itemId}:${enchantmentId}`);
      window.setTimeout(() => setPortalItem(null), 1400);
      toast.success("Enchantment applied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enchant item");
    } finally {
      setBusyLoot(null);
    }
  }

  async function drawLottery() {
    setRolling("lottery");
    setLotteryPrize(null);
    try {
      const prize = await spinLottery();
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      setRolling(null);
      setLotteryPrize(prize);
      toast.success(prize ? `Lucky draw: ${prize} coins!` : "No coins this time — try again!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not spin the lottery");
    } finally {
      setRolling(null);
    }
  }

  async function openCrate(rarity: WeaponSkinRarity) {
    setCrateBusy(rarity);
    setRolling(rarity);
    setReveal(null);
    try {
      const result = await openWeaponCrateFromProgress(rarity);
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      const skin = getWeaponSkin(result.skinId);
      setReveal({
        name: skin?.name ?? "All skins collected",
        color: skin?.color ?? "#80ff20",
        rarity,
        refunded: result.refunded,
      });
      toast.success(
        result.refunded
          ? "You already own every skin in this crate. Your coins were refunded."
          : `${skin?.name ?? "New skin"} unlocked!`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open crate");
    } finally {
      setRolling(null);
      setCrateBusy(null);
    }
  }

  async function equipSkin(skinId: WeaponSkinId | null) {
    setSkinBusy(skinId ?? "unequip");
    try {
      await equipWeaponSkin(skinId);
      toast.success(skinId ? `${getWeaponSkin(skinId)?.name} equipped` : "Weapon skin removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not equip weapon skin");
    } finally {
      setSkinBusy(null);
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
            className={`mso-btn ${section === "workshop" ? "" : "mso-btn-ghost"}`}
            role="tab"
            aria-selected={section === "workshop"}
            onClick={() => setSection("workshop")}
          >
            CRAFT & ENCHANT
          </button>
          <button
            type="button"
            className={`mso-btn ${section === "crates" ? "" : "mso-btn-ghost"}`}
            role="tab"
            aria-selected={section === "crates"}
            onClick={() => setSection("crates")}
          >
            CRATES & LUCKY DRAW
          </button>
          <button
            type="button"
            className={`mso-btn ${section === "codes" ? "" : "mso-btn-ghost"}`}
            role="tab"
            aria-selected={section === "codes"}
            onClick={() => setSection("codes")}
          >
            CODES & REWARDS
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
                  <p className="text-sm text-muted-foreground">
                    {ARMOUR_REDUCTION[item.id]
                      ? `Damage reduction: ${ARMOUR_REDUCTION[item.id]}%`
                      : "Cosmetic outfit. No damage reduction."}
                  </p>
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
        ) : section === "workshop" ? (
          <section className="workshop-layout">
            {portalItem && (
              <div className="enchant-portal" role="status" aria-label="Item enchanted">
                <div className="enchant-portal-ring" />
                <span>ENCHANTED</span>
              </div>
            )}
            <div className="loot-chest workshop-chest">
              <div className="loot-chest-lid"><span>CRAFTING CHEST</span></div>
              <div className="loot-chest-body">
                {p.loot.hotbar.slots.filter((stack) => stack && !["book", "shard"].includes(stack.item)).map((stack) => (
                  <span className="loot-chip" key={stack!.item}>{stack!.count}× {stack!.item.replaceAll("-", " ")}</span>
                ))}
                {p.loot.materials.scrap + p.loot.materials.bone + p.loot.materials.essence === 0 && <b>CHEST EMPTY</b>}
              </div>
            </div>
            <div className="loot-chest enchant-chest">
              <div className="loot-chest-lid"><span>ENCHANTING CHEST</span></div>
              <div className="loot-chest-body">
                <span className="loot-chip">📘 {p.loot.books} BOOKS</span>
                <span className="loot-chip">◆ {p.loot.shards} SHARDS</span>
              </div>
            </div>
            <div className="workshop-grid">
              {CRAFTING_RECIPES.map((recipe) => {
                const owned = p.loot.crafted.includes(recipe.id);
                const materials = Object.entries(recipe.materials).map(([material, amount]) =>
                  `${p.loot.materials[material as keyof typeof p.loot.materials]}/${amount} ${material}`,
                ).join(" · ");
                return (
                  <article key={recipe.id} className="mso-card flex flex-col gap-3 p-5">
                    <div className="mso-display text-2xl">{recipe.name}</div>
                    <p className="text-sm text-muted-foreground">{materials}</p>
                    <button type="button" className="mso-btn mt-auto" disabled={p.kind === "loading" || owned || busyLoot !== null || !canCraft(p.loot, recipe.id, p.credits)} onClick={() => void craft(recipe.id)}>
                      {owned ? "CRAFTED" : `CRAFT · ${recipe.fee} COINS`}
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="enchant-grid">
              {p.loot.crafted.length === 0 ? (
                <p className="text-sm text-muted-foreground">Craft a sword or armor piece first to enchant it.</p>
              ) : p.loot.crafted.flatMap((itemId) =>
                ENCHANTMENTS.map((enchantment) => {
                  const key = `${itemId}:${enchantment.id}`;
                  const done = p.loot.enchanted.includes(key);
                  const ready = canEnchant(p.loot, itemId, enchantment.id);
                  return (
                    <article key={key} className="mso-card enchant-option p-5">
                      <div className="enchant-rune">✦</div>
                      <div className="mso-display text-xl">{itemId.replaceAll("-", " ")} · {enchantment.name}</div>
                      <p className="text-sm text-muted-foreground">{enchantment.description}</p>
                      <button type="button" className="mso-btn mt-auto" disabled={done || !ready || busyLoot !== null} onClick={() => enchant(itemId, enchantment.id)}>
                        {done ? "ENCHANTED" : "ENCHANT"}
                      </button>
                    </article>
                  );
                }),
              )}
            </div>
          </section>
        ) : section === "crates" ? (
          <section className="gacha-layout">
            <article className="mso-panel lottery-panel">
              <div className="hub-info-kicker">COIN PRIZE DRAW</div>
              <h2 className="mso-display mt-1 text-3xl">LUCKY DRAW</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Spend {LOTTERY_PRICE} coins for a chance at a coin payout. Odds: 35% no prize,
                35% · 50, 18% · 100, 9% · 250, 3% · 1,000.
              </p>
              <div className={`lottery-reel${rolling === "lottery" ? " is-rolling" : ""}`} aria-live="polite">
                {rolling === "lottery"
                  ? "ROLLING…"
                  : lotteryPrize === null
                    ? "?"
                    : `+${lotteryPrize} ¢`}
              </div>
              <button
                type="button"
                className="mso-btn"
                disabled={p.kind === "loading" || rolling !== null || p.credits < LOTTERY_PRICE}
                onClick={() => void drawLottery()}
              >
                {p.credits < LOTTERY_PRICE
                  ? `NEED ${LOTTERY_PRICE - p.credits} MORE COINS`
                  : `DRAW · ${LOTTERY_PRICE} COINS`}
              </button>
            </article>
            <div className="crate-section">
              <div>
                <div className="hub-info-kicker">GUARANTEED RARITY · UNIQUE SKINS</div>
                <h2 className="mso-display mt-1 text-3xl">WEAPON CRATES</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Each crate rolls an animation and unlocks one new gun skin of its rarity.
                  Collected skins work on every weapon.
                </p>
              </div>
              <div className="crate-grid">
                {WEAPON_CRATES.map(({ rarity, price }) => {
                  const owned = p.weaponSkins.filter(
                    (id) => getWeaponSkin(id)?.rarity === rarity,
                  ).length;
                  const total = WEAPON_SKINS.filter((skin) => skin.rarity === rarity).length;
                  return (
                    <article
                      key={rarity}
                      className={`mso-card crate-card crate-rarity-${rarity}${crateBusy === rarity ? " is-opening" : ""}`}
                    >
                      <div className="crate-box" aria-hidden="true"><span className="crate-lid" /><span className="crate-lock" /></div>
                      <div className="crate-rarity-label">{rarity.toUpperCase()}</div>
                      <p className="text-sm text-muted-foreground">{owned}/{total} unique skins</p>
                      <button
                        type="button"
                        className="mso-btn mt-auto"
                        disabled={
                          p.kind === "loading" ||
                          rolling !== null ||
                          crateBusy !== null ||
                          p.credits < price ||
                          owned === total
                        }
                        onClick={() => void openCrate(rarity)}
                      >
                        {crateBusy === rarity
                          ? "OPENING…"
                          : owned === total
                          ? "ALL COLLECTED"
                          : p.credits < price
                            ? `NEED ${price - p.credits} MORE`
                            : `OPEN · ${price} COINS`}
                      </button>
                    </article>
                  );
                })}
              </div>
              {(crateBusy !== null || reveal) && (
                <div key={crateBusy ? `opening-${crateBusy}` : `reveal-${reveal?.name}`} className={`crate-reveal mso-panel${crateBusy ? " is-opening" : " is-revealed"}`} aria-live="polite" role="status" aria-busy={crateBusy !== null}>
                  <div
                    className={`crate-reveal-icon${crateBusy !== null ? " is-rolling" : ""}`}
                    style={{ "--reveal-color": reveal?.color ?? "#80ff20" } as CSSProperties}
                  >
                    {crateBusy !== null ? <div className={`crate-box crate-rarity-${crateBusy}`} aria-hidden="true"><span className="crate-lid" /><span className="crate-lock" /></div> : reveal?.refunded ? "✓" : <span className="crate-reward-swatch" style={{ backgroundColor: reveal?.color }} />}
                  </div>
                  <div className="hub-info-kicker">
                    {crateBusy !== null ? `${crateBusy.toUpperCase()} CRATE OPENING` : reveal?.rarity.toUpperCase()}
                  </div>
                  <strong className="mso-display text-2xl">
                    {crateBusy !== null ? "UNLOCKING…" : reveal?.name}
                  </strong>
                </div>
              )}
              <div>
                <div className="hub-info-kicker">YOUR COLLECTION</div>
                <h3 className="mso-display mt-1 text-2xl">WEAPON SKINS</h3>
                <div className="weapon-skin-grid">
                  {p.weaponSkins.map((id) => {
                    const skin = getWeaponSkin(id);
                    if (!skin) return null;
                    const equipped = p.equippedWeaponSkin === id;
                    return (
                      <article key={id} className={`weapon-skin-card crate-rarity-${skin.rarity}`}>
                        <span className="weapon-skin-swatch" style={{ backgroundColor: skin.color }} />
                        <span className="weapon-skin-name">{skin.name}</span>
                        <span className="weapon-skin-rarity">{skin.rarity}</span>
                        <button
                          type="button"
                          className={`mso-btn ${equipped ? "mso-btn-ghost" : ""}`}
                          disabled={equipped || skinBusy !== null || rolling !== null}
                          onClick={() => void equipSkin(id)}
                        >
                          {equipped ? "EQUIPPED" : "EQUIP"}
                        </button>
                      </article>
                    );
                  })}
                  {p.weaponSkins.length === 0 && (
                    <p className="text-sm text-muted-foreground">Open a crate to collect your first weapon skin.</p>
                  )}
                  {p.equippedWeaponSkin && (
                    <button
                      type="button"
                      className="mso-btn mso-btn-ghost"
                      disabled={skinBusy !== null || rolling !== null}
                      onClick={() => void equipSkin(null)}
                    >
                      REMOVE EQUIPPED SKIN
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="codes-panel mso-panel">
            <div className="hub-info-kicker">SECRET REDEEMABLES</div>
            <h2 className="mso-display mt-1 text-3xl">CODES & REWARDS</h2>
            <form className="codes-form" onSubmit={async (event) => {
              event.preventDefault();
              if (codeBusy) return;
              setCodeBusy(true);
              try {
                const result = await redeemCode(code);
                toast.success(`${result.reward} · code redeemed`);
                setCode("");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not redeem code");
              } finally {
                setCodeBusy(false);
              }
            }}>
              <input
                aria-label="Enter reward code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))}
                placeholder="ENTER CODE"
                maxLength={32}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button className="mso-btn" type="submit" disabled={!code.trim() || codeBusy || p.kind === "loading"}>{codeBusy ? "REDEEMING…" : "REDEEM"}</button>
            </form>
            <div className="codes-status">
              <a className="mso-btn" href="/racing">PLAY 3D CAR RACE</a>
            </div>
          </section>
        )}
      </PageShell>
    </>
  );
}
