export type HotbarItemId =
  | "scrap"
  | "bone"
  | "essence"
  | "book"
  | "shard"
  | "scrap-sword"
  | "ember-sword"
  | "bone-armor";

export type HotbarItem = {
  name: string;
  rarity: number;
};

export const HOTBAR_ITEMS: Record<HotbarItemId, HotbarItem> = {
  scrap: { name: "Scrap", rarity: 0 },
  bone: { name: "Bone", rarity: 1 },
  essence: { name: "Essence", rarity: 2 },
  book: { name: "Enchant Book", rarity: 2 },
  shard: { name: "Enchant Shard", rarity: 3 },
  "scrap-sword": { name: "Scrap Sword", rarity: 2 },
  "ember-sword": { name: "Ember Sword", rarity: 3 },
  "bone-armor": { name: "Bone Armor", rarity: 2 },
};

export type HotbarStack = {
  item: HotbarItemId;
  count: number;
};

export type HotbarInventory = {
  slots: (HotbarStack | null)[];
  bundle: HotbarStack[];
  selected: number;
};

export const HOTBAR_SLOT_COUNT = 9;
export const HOTBAR_STACK_LIMIT = 8;
export const HOTBAR_BUNDLE_LIMIT = 10;

export const EMPTY_HOTBAR: HotbarInventory = {
  slots: Array.from({ length: HOTBAR_SLOT_COUNT - 1 }, () => null),
  bundle: [],
  selected: 0,
};

export function isHotbarItemId(value: string): value is HotbarItemId {
  return Object.hasOwn(HOTBAR_ITEMS, value);
}

export function hotbarItemCount(inventory: HotbarInventory): number {
  return inventory.slots.reduce((sum, stack) => sum + (stack?.count ?? 0), 0) +
    inventory.bundle.reduce((sum, stack) => sum + stack.count, 0);
}

function addToStacks(
  stacks: (HotbarStack | null)[],
  item: HotbarItemId,
): boolean {
  const existing = stacks.find((stack) => stack?.item === item && stack.count < HOTBAR_STACK_LIMIT);
  if (existing) {
    existing.count++;
    return true;
  }
  const emptyIndex = stacks.findIndex((stack) => stack === null);
  if (emptyIndex === -1) return false;
  stacks[emptyIndex] = { item, count: 1 };
  return true;
}

export function addHotbarItem(
  inventory: HotbarInventory,
  item: HotbarItemId,
): { inventory: HotbarInventory; accepted: boolean; replaced?: HotbarItemId } {
  const next = structuredClone(inventory);
  if (addToStacks(next.slots, item)) return { inventory: next, accepted: true };

  const bundleUnits = next.bundle.reduce((sum, stack) => sum + stack.count, 0);
  if (bundleUnits < HOTBAR_BUNDLE_LIMIT && addToStacks(next.bundle, item)) {
    return { inventory: next, accepted: true };
  }

  if (bundleUnits < HOTBAR_BUNDLE_LIMIT) {
    next.bundle.push({ item, count: 1 });
    return { inventory: next, accepted: true };
  }

  const leastRareIndex = next.bundle.reduce(
    (least, stack, index, stacks) =>
      HOTBAR_ITEMS[stack.item].rarity < HOTBAR_ITEMS[stacks[least].item].rarity ? index : least,
    0,
  );
  const replaced = next.bundle[leastRareIndex];
  if (HOTBAR_ITEMS[item].rarity <= HOTBAR_ITEMS[replaced.item].rarity) {
    return { inventory, accepted: false };
  }

  if (replaced.count > 1) replaced.count--;
  else next.bundle.splice(leastRareIndex, 1);
  const matching = next.bundle.find(
    (stack) => stack.item === item && stack.count < HOTBAR_STACK_LIMIT,
  );
  if (matching) matching.count++;
  else next.bundle.push({ item, count: 1 });
  return { inventory: next, accepted: true, replaced: replaced.item };
}

export function removeHotbarItem(
  inventory: HotbarInventory,
  slot: number,
): { inventory: HotbarInventory; item: HotbarItemId | null } {
  if (!Number.isInteger(slot) || slot < 0 || slot >= HOTBAR_SLOT_COUNT - 1) {
    return { inventory, item: null };
  }
  const next = structuredClone(inventory);
  const stack = next.slots[slot];
  if (!stack) return { inventory, item: null };
  const item = stack.item;
  if (stack.count > 1) stack.count--;
  else next.slots[slot] = null;
  return { inventory: next, item };
}

export function parseHotbar(value: unknown): HotbarInventory {
  if (!value || typeof value !== "object") return structuredClone(EMPTY_HOTBAR);
  const candidate = value as Partial<HotbarInventory>;
  const slots = Array.isArray(candidate.slots) ? candidate.slots : [];
  const bundle = Array.isArray(candidate.bundle) ? candidate.bundle : [];
  const cleanStack = (input: unknown): HotbarStack | null => {
    if (!input || typeof input !== "object") return null;
    const stack = input as Partial<HotbarStack>;
    if (typeof stack.item !== "string" || !isHotbarItemId(stack.item)) return null;
    const count = Number(stack.count);
    if (!Number.isInteger(count) || count < 1) return null;
    return { item: stack.item, count: Math.min(count, HOTBAR_STACK_LIMIT) };
  };
  const cleanSlots = Array.from({ length: HOTBAR_SLOT_COUNT - 1 }, (_, index) =>
    cleanStack(slots[index]),
  );
  const cleanBundle: HotbarStack[] = [];
  let bundleUnits = 0;
  for (const rawStack of bundle) {
    const stack = cleanStack(rawStack);
    if (!stack || bundleUnits >= HOTBAR_BUNDLE_LIMIT) continue;
    stack.count = Math.min(stack.count, HOTBAR_BUNDLE_LIMIT - bundleUnits);
    cleanBundle.push(stack);
    bundleUnits += stack.count;
  }
  const selected = Number(candidate.selected);
  return {
    slots: cleanSlots,
    bundle: cleanBundle,
    selected: Number.isInteger(selected) && selected >= 0 && selected < HOTBAR_SLOT_COUNT ? selected : 0,
  };
}
