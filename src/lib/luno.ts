export type Color = "red" | "yellow" | "green" | "blue" | "wild";
export type Value = string; // "0"-"9", "skip", "reverse", "+2", "wild", "+4"
export type Card = { id: string; color: Color; value: Value };

const COLORS: Color[] = ["red", "yellow", "green", "blue"];

export function makeDeck(): Card[] {
  const d: Card[] = [];
  let n = 0;
  const add = (color: Color, value: Value) => d.push({ id: `c${n++}`, color, value });
  for (const c of COLORS) {
    add(c, "0");
    for (let i = 0; i < 2; i++) {
      for (let v = 1; v <= 9; v++) add(c, String(v));
      add(c, "skip"); add(c, "reverse"); add(c, "+2");
    }
  }
  for (let i = 0; i < 4; i++) { add("wild", "wild"); add("wild", "+4"); }
  return shuffle(d);
}

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function canPlay(card: Card, top: Card, current: Color): boolean {
  return card.color === "wild" || card.color === current || card.value === top.value;
}

export function bestColor(hand: Card[]): Color {
  const counts: Record<string, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  hand.forEach((c) => c.color !== "wild" && counts[c.color]++);
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as Color;
}
