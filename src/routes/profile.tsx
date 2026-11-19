import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CharacterPreview } from "@/components/game/CharacterPreview";
import { ExperienceBar } from "@/components/game/ExperienceBar";
import { PageShell } from "@/components/game/Picker";
import { TopBar } from "@/components/game/TopBar";
import { useProgress } from "@/components/game/useProgress";
import {
  buyCosmetic,
  customizeAvatar,
  setEquippedCosmetic,
  unlockAvatarCustomization,
} from "@/game/progress";
import { AVATAR_PRICE } from "@/game/sim/economy";
import { COSMETICS, type CosmeticId, type CosmeticSlot } from "@/game/sim/cosmetics";
import {
  AVATAR_COLOR_OPTIONS,
  randomizeAvatarColors,
  type AvatarColorKey,
  type AvatarColors,
} from "@/game/sim/avatar";
import { experienceRequiredForLevel } from "@/game/sim/progression";
import { searchPlayers } from "@/game/profile.functions";

type PlayerSearchResult = {
  display_name: string;
  level: number;
  experience: number;
  dungeons_completed: number;
  enemies_killed: number;
  deaths: number;
  hours_played: number;
};

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Player Profile — Mexican Standof" },
      {
        name: "description",
        content: "View your player stats, customize outfits, and unlock block-style avatar colors.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const progress = useProgress();
  const [slot, setSlot] = useState<CosmeticSlot>("shirt");
  const [shopTab, setShopTab] = useState<"outfits" | "skin">("outfits");
  const [busy, setBusy] = useState<string | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [players, setPlayers] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

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

  async function search() {
    if (playerQuery.trim().length < 2) return;
    setSearching(true);
    try {
      setPlayers(await searchPlayers({ data: { query: playerQuery } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not search players");
    } finally {
      setSearching(false);
    }
  }

  async function unlockBlockStyle() {
    setBusy("avatar-customization");
    try {
      await unlockAvatarCustomization();
      toast.success("Block-style avatar customization unlocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unlock customization");
    } finally {
      setBusy(null);
    }
  }

  async function changeAvatarColors(colors: AvatarColors) {
    setBusy("avatar-colors");
    try {
      await customizeAvatar(colors);
      toast.success("Avatar updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update avatar");
    } finally {
      setBusy(null);
    }
  }

  const colorSlots: { key: AvatarColorKey; label: string }[] = [
    { key: "headColor", label: "HEAD" },
    { key: "hairColor", label: "HAIR" },
    { key: "bodyColor", label: "BODY" },
    { key: "feetColor", label: "FEET" },
    { key: "bootsColor", label: "BOOTS" },
    { key: "accessoriesColor", label: "ACCESSORIES" },
    { key: "maskColor", label: "MASK" },
    { key: "hatColor", label: "HAT" },
    { key: "dressColor", label: "DRESS" },
  ];

  const equippedBySlot = {
    shirt: progress.equippedShirt,
    hat: progress.equippedHat,
    pants: progress.equippedPants,
    boots: progress.equippedBoots,
  };

  return (
    <>
      <TopBar />
      <PageShell title="PLAYER PROFILE" kicker="OPERATOR">
        <div className="profile-customization-layout">
          <section className="profile-summary mso-panel">
            <div className="profile-operator-preview">
              <CharacterPreview
                shirtId={progress.equippedShirt}
                hatId={progress.equippedHat}
                pantsId={progress.equippedPants}
                bootsId={progress.equippedBoots}
                weaponId={progress.equipped}
                avatarColors={progress.avatarCustomizationUnlocked ? progress.avatarColors : undefined}
                weaponSkinId={progress.equippedWeaponSkin}
                rotatable
              />
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
                <strong>{progress.unlimitedMoney ? "∞" : progress.credits} ¢</strong>
              </div>
              <div>
                <span>HOURS PLAYED</span>
                <strong>{(progress.playSeconds / 3600).toFixed(1)} h</strong>
              </div>
              <div>
                <span>ENEMIES KILLED</span>
                <strong>{progress.enemiesKilled}</strong>
              </div>
              <div>
                <span>DEATHS</span>
                <strong>{progress.deaths}</strong>
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
                pantsId={progress.equippedPants}
                bootsId={progress.equippedBoots}
                avatarColors={progress.avatarCustomizationUnlocked ? progress.avatarColors : undefined}
                weaponSkinId={progress.equippedWeaponSkin}
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
                {progress.unlimitedMoney ? "∞" : progress.credits}
              </div>
            </div>

            <div
              className="mt-6 flex flex-wrap gap-2"
              role="tablist"
              aria-label="Profile customization"
            >
              {(["outfits", "skin"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`mso-btn ${shopTab === value ? "" : "mso-btn-ghost"}`}
                  role="tab"
                  id={`${value}-tab`}
                  aria-controls={`${value}-panel`}
                  aria-selected={shopTab === value}
                  onClick={() => setShopTab(value)}
                >
                  {value === "outfits" ? "OUTFITS" : "SKIN"}
                </button>
              ))}
            </div>

            {shopTab === "outfits" ? (
              <div id="outfits-panel" role="tabpanel" aria-labelledby="outfits-tab">
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["shirt", "hat", "pants", "boots"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`mso-btn ${slot === value ? "" : "mso-btn-ghost"}`}
                      aria-pressed={slot === value}
                      onClick={() => setSlot(value)}
                    >
                      {value === "shirt"
                        ? "SHIRTS & OUTFITS"
                        : value === "hat"
                          ? "HEADWEAR"
                          : value.toUpperCase()}
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
                          <CharacterPreview
                            compact
                            shirtId={item.slot === "shirt" ? item.id : progress.equippedShirt}
                            hatId={item.slot === "hat" ? item.id : progress.equippedHat}
                            pantsId={item.slot === "pants" ? item.id : progress.equippedPants}
                            bootsId={item.slot === "boots" ? item.id : progress.equippedBoots}
                            avatarColors={
                              progress.avatarCustomizationUnlocked
                                ? progress.avatarColors
                                : undefined
                            }
                          />
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
              </div>
            ) : (
              <div
                id="skin-panel"
                role="tabpanel"
                aria-labelledby="skin-tab"
                className="profile-skin-studio mt-5"
              >
                <div className="profile-skin-preview">
                  <CharacterPreview
                    compact
                    shirtId={progress.equippedShirt}
                    hatId={progress.equippedHat}
                    pantsId={progress.equippedPants}
                    bootsId={progress.equippedBoots}
                    avatarColors={
                      progress.avatarCustomizationUnlocked ? progress.avatarColors : undefined
                    }
                  />
                </div>
                <div className="profile-skin-controls">
                  <div className="hub-info-kicker">BLOCK-STYLE SKIN STUDIO</div>
                  <h3 className="mso-display mt-1 text-2xl">YOUR COLORS, YOUR OPERATOR</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose colors for every part of your character. Randomize for a fresh look.
                  </p>
                  {!progress.avatarCustomizationUnlocked ? (
                    <>
                      <button
                        type="button"
                        className="mso-btn mt-4"
                        disabled={
                          progress.kind === "loading" || progress.credits < AVATAR_PRICE || busy !== null
                        }
                        onClick={() => void unlockBlockStyle()}
                      >
                        {progress.credits < AVATAR_PRICE
                            ? `NEED ${AVATAR_PRICE - progress.credits} MORE COINS`
                            : `UNLOCK SKIN STUDIO · ${AVATAR_PRICE.toLocaleString()} COINS`}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="mso-btn mt-4"
                        disabled={busy !== null}
                        onClick={() => void changeAvatarColors(randomizeAvatarColors())}
                      >
                        RANDOMIZE SKIN
                      </button>
                      <div className="avatar-palette mt-5">
                        {colorSlots.map(({ key, label }) => (
                          <div key={key} className="avatar-palette-row">
                            <span className="avatar-palette-label">{label}</span>
                            <div className="avatar-color-options">
                              {AVATAR_COLOR_OPTIONS.map((color) => (
                                <button
                                  key={`${key}-${color}`}
                                  type="button"
                                  className={`avatar-color-option${progress.avatarColors[key] === color ? " is-selected" : ""}`}
                                  style={{ backgroundColor: color }}
                                  aria-label={`Set ${label.toLowerCase()} color ${color}`}
                                  aria-pressed={progress.avatarColors[key] === color}
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void changeAvatarColors({
                                      ...progress.avatarColors,
                                      [key]: color,
                                    })
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
        <section className="player-directory mso-panel">
          <div className="hub-info-kicker">COMMUNITY</div>
          <h2 className="mso-display mt-1 text-3xl">FIND A PLAYER</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Search signed-in players by display name. Public results show game stats only.
          </p>
          {progress.kind === "account" ? (
            <>
              <form
                className="mt-5 flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void search();
                }}
              >
                <input
                  aria-label="Search players by display name"
                  className="player-search-input"
                  placeholder="Enter at least 2 characters"
                  value={playerQuery}
                  maxLength={32}
                  minLength={2}
                  onChange={(event) => setPlayerQuery(event.target.value)}
                />
                <button className="mso-btn" type="submit" disabled={searching || playerQuery.trim().length < 2}>
                  {searching ? "SEARCHING…" : "SEARCH"}
                </button>
              </form>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {players.map((player, index) => (
                  <article key={`${player.display_name}-${index}`} className="player-result mso-card">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="mso-display text-xl">{player.display_name}</h3>
                      <span className="mso-chip">LEVEL {player.level}</span>
                    </div>
                    <div className="player-result-stats">
                      <span>{player.experience} / {experienceRequiredForLevel(player.level)} EXP</span>
                      <span>{player.dungeons_completed} dungeons</span>
                      <span>{player.hours_played.toFixed(1)} hours</span>
                      <span>{player.enemies_killed} kills</span>
                      <span>{player.deaths} deaths</span>
                    </div>
                  </article>
                ))}
                {players.length === 0 && !searching && playerQuery.trim().length >= 2 && (
                  <p className="text-sm text-muted-foreground">No players found. Try another name.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Sign in to find other players.</p>
          )}
        </section>
      </PageShell>
    </>
  );
}
