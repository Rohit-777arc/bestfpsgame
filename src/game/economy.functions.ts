import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getEconomyDatabase } from "../../db";
import { playerEconomies } from "../../db/schema";
import { getProfile } from "./profile.functions";
import {
  applyEconomyAction,
  freshEconomy,
  UNLIMITED_CREDITS,
  type EconomyAction,
  type EconomyState,
} from "./sim/economy";
import { isAvatarColors } from "./sim/avatar";

const count = z.number().int().min(0).max(1_000_000);
const stack = z.object({
  item: z.enum([
    "scrap",
    "bone",
    "essence",
    "book",
    "shard",
    "scrap-sword",
    "ember-sword",
    "bone-armor",
  ]),
  count: z.number().int().min(1).max(8),
});
const loot = z.object({
  materials: z.object({ scrap: count, bone: count, essence: count }),
  books: count,
  shards: count,
  crafted: z.array(z.string().max(64)).max(100),
  enchanted: z.array(z.string().max(64)).max(100),
  hotbar: z.object({
    slots: z.array(stack.nullable()).max(9),
    bundle: z.array(stack).max(10),
    selected: z.number().int().min(0).max(8),
  }),
});
const colors = z.custom<EconomyState["avatarColors"]>(isAvatarColors);
const action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("load") }),
  z.object({ kind: z.literal("code"), code: z.string().min(1).max(32) }),
  ...(["weapon", "cosmetic", "crate", "craft", "equipWeapon"] as const).map((kind) =>
    z.object({ kind: z.literal(kind), id: z.string().max(64) }),
  ),
  ...(["lottery", "avatar"] as const).map((kind) => z.object({ kind: z.literal(kind) })),
  z.object({ kind: z.literal("equipSkin"), id: z.string().max(64).nullable() }),
  z.object({
    kind: z.literal("equipCosmetic"),
    slot: z.enum(["shirt", "hat", "pants", "boots"]),
    id: z.string().max(64).nullable(),
  }),
  z.object({ kind: z.literal("colors"), colors }),
  z.object({ kind: z.literal("loot"), loot }),
  z.object({
    kind: z.literal("wave"),
    difficulty: z.enum(["easy", "normal", "hard"]),
    wave: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    runId: z.string().max(128).nullable(),
    mode: z.enum(["dungeon", "coop"]),
    variant: z.enum(["gunfight", "underground"]).optional(),
  }),
]);
const seed = z
  .object({
    redeemedCodes: z.array(z.string().max(32)).max(100).optional(),
    credits: count.optional(),
    weapons: z.array(z.string()).max(100).optional(),
    cosmetics: z.array(z.string()).max(100).optional(),
    weaponSkins: z.array(z.string()).max(100).optional(),
    equipped: z.string().optional(),
    equippedShirt: z.string().nullable().optional(),
    equippedHat: z.string().nullable().optional(),
    equippedPants: z.string().nullable().optional(),
    equippedBoots: z.string().nullable().optional(),
    equippedWeaponSkin: z.string().nullable().optional(),
    avatarCustomizationUnlocked: z.boolean().optional(),
    avatarColors: colors.optional(),
    loot: loot.optional(),
    racingUnlocked: z.boolean().optional(),
  })
  .optional();

export const updateEconomy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ action, seed }).parse(input))
  .handler(async ({ data }) => {
    let playerId: string;
    let initial = data.seed as Partial<EconomyState> | undefined;
    if (getRequest().headers.has("authorization")) {
      const profile = await getProfile();
      playerId = `account:${profile.userId}`;
      initial = {
        ...profile,
        loot: initial?.loot,
        redeemedCodes: initial?.redeemedCodes,
        racingUnlocked: initial?.racingUnlocked,
      } as Partial<EconomyState>;
    } else {
      let guestId = getCookie("mso-economy-player");
      if (!guestId || !z.string().uuid().safeParse(guestId).success) {
        guestId = crypto.randomUUID();
        setCookie("mso-economy-player", guestId, {
          httpOnly: true,
          sameSite: "lax",
          secure: getRequest().url.startsWith("https:"),
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      playerId = `guest:${guestId}`;
    }
    const db = getEconomyDatabase();
    const result = await db.transaction(async (tx) => {
      await tx
        .insert(playerEconomies)
        .values({ playerId, progress: freshEconomy(initial) })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(playerEconomies)
        .where(eq(playerEconomies.playerId, playerId))
        .for("update");
      const result = applyEconomyAction(
        row.progress,
        data.action as EconomyAction,
        Math.random,
        Date.now(),
        crypto.randomUUID(),
      );
      await tx
        .update(playerEconomies)
        .set({ progress: result.state })
        .where(eq(playerEconomies.playerId, playerId));
      return result;
    });
    return {
      ...result,
      state: {
        ...result.state,
        credits: result.state.unlimitedMoney ? UNLIMITED_CREDITS : result.state.credits,
      },
    };
  });
