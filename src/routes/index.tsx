import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeDeck, canPlay, bestColor, shuffle, type Card, type Color } from "@/lib/luno";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LUNO — Play the Card Game Online" },
      { name: "description", content: "Play LUNO, the wild color-matching card game, against 3 bots right in your browser." },
      { property: "og:title", content: "LUNO — Play the Card Game Online" },
      { property: "og:description", content: "Match colors, drop +4s, and shout LUNO. Play free in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const NAMES = ["You", "Bot Blaze", "Bot Pixel", "Bot Nova"];

type G = {
  deck: Card[]; discard: Card[]; hands: Card[][];
  turn: number; dir: 1 | -1; color: Color; msg: string; winner: number | null; from: number;
};

function newGame(): G {
  let deck = makeDeck();
  const hands = [0, 1, 2, 3].map(() => deck.splice(0, 7));
  let i = deck.findIndex((c) => c.color !== "wild" && /^\d$/.test(c.value));
  const [top] = deck.splice(i, 1);
  return { deck, discard: [top], hands, turn: 0, dir: 1, color: top.color, msg: "Your turn!", winner: null, from: -1 };
}

function draw(g: G, p: number, n: number) {
  for (let k = 0; k < n; k++) {
    if (!g.deck.length) {
      const top = g.discard.pop()!;
      g.deck = shuffle(g.discard); g.discard = [top];
      if (!g.deck.length) return;
    }
    g.hands[p].push(g.deck.pop()!);
  }
}
const nextP = (g: G, s = 1) => (((g.turn + g.dir * s) % 4) + 4) % 4;

function play(prev: G, p: number, card: Card, chosen?: Color): G {
  const g: G = { ...prev, deck: [...prev.deck], discard: [...prev.discard, card], hands: prev.hands.map((h) => [...h]) };
  g.from = p;
  g.hands[p] = g.hands[p].filter((c) => c.id !== card.id);
  g.color = card.color === "wild" ? chosen ?? bestColor(g.hands[p]) : card.color;
  if (!g.hands[p].length) { g.winner = p; g.msg = p === 0 ? "You win! 🎉" : `${NAMES[p]} wins!`; return g; }
  let skip = 1;
  if (card.value === "reverse") g.dir = (g.dir * -1) as 1 | -1;
  if (card.value === "skip") skip = 2;
  if (card.value === "+2") { draw(g, nextP(g), 2); skip = 2; }
  if (card.value === "+4") { draw(g, nextP(g), 4); skip = 2; }
  g.msg = `${NAMES[p]} played ${card.value}${card.color === "wild" ? ` → ${g.color}` : ""}${g.hands[p].length === 1 ? " — LUNO!" : ""}`;
  g.turn = nextP(g, skip);
  return g;
}

function CardView({ card, onClick, playable, small }: { card: Card; onClick?: () => void; playable?: boolean; small?: boolean }) {
  const label = card.value === "reverse" ? "⇄" : card.value === "skip" ? "⊘" : card.value === "wild" ? "★" : card.value;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`luno-card luno-${card.color} ${small ? "h-24 w-16 text-2xl" : "h-32 w-20 text-3xl"} luno-enter ${playable ? "luno-playable" : onClick ? "opacity-60" : ""}`}
    >
      <span className="luno-oval">{label}</span>
    </button>
  );
}

function Index() {
  const [g, setG] = useState<G | null>(null);
  const [pending, setPending] = useState<Card | null>(null);
  useEffect(() => setG(newGame()), []);

  useEffect(() => {
    if (!g || g.winner !== null || g.turn === 0) return;
    const t = setTimeout(() => {
      const p = g.turn;
      const top = g.discard[g.discard.length - 1];
      const opts = g.hands[p].filter((c) => canPlay(c, top, g.color));
      const pick = opts.find((c) => c.color !== "wild") ?? opts[0];
      if (pick) setG(play(g, p, pick));
      else {
        const n: G = { ...g, deck: [...g.deck], discard: [...g.discard], hands: g.hands.map((h) => [...h]) };
        draw(n, p, 1); n.msg = `${NAMES[p]} drew a card`; n.turn = nextP(n); setG(n);
      }
    }, 1700);
    return () => clearTimeout(t);
  }, [g]);

  if (!g) return <div className="min-h-screen" />;
  const top = g.discard[g.discard.length - 1];
  const myTurn = g.turn === 0 && g.winner === null;

  const clickCard = (c: Card) => {
    if (!myTurn || !canPlay(c, top, g.color)) return;
    if (c.color === "wild") setPending(c); else setG(play(g, 0, c));
  };
  const drawMine = () => {
    if (!myTurn) return;
    const n: G = { ...g, deck: [...g.deck], discard: [...g.discard], hands: g.hands.map((h) => [...h]) };
    draw(n, 0, 1); n.msg = "You drew a card"; n.turn = nextP(n); setG(n);
  };

  return (
    <main className="min-h-screen luno-felt px-4 py-6 text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <h1 className="luno-logo text-5xl">LUNO</h1>
        <button onClick={() => { setG(newGame()); setPending(null); }} className="rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">New game</button>
      </header>

      <section className="mx-auto mt-6 grid max-w-5xl grid-cols-3 gap-3">
        {[1, 2, 3].map((p) => (
          <div key={p} className={`rounded-2xl bg-card/60 p-3 text-center ${g.turn === p ? "ring-4 ring-primary" : ""}`}>
            <div className="font-bold">{NAMES[p]}</div>
            <div className="text-sm text-muted-foreground">{g.hands[p].length} cards{g.hands[p].length === 1 && " · LUNO!"}</div>
            <div className="mt-2 flex justify-center -space-x-8">
              {g.hands[p].slice(0, 10).map((c) => <div key={c.id} className="luno-back luno-enter h-14 w-10" />)}
            </div>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-10 flex max-w-5xl flex-col items-center gap-4">
        <div className="flex items-center gap-8">
          <button onClick={drawMine} disabled={!myTurn} className="luno-back luno-deck h-32 w-20 text-sm font-bold">DRAW</button>
          <div className="relative h-32 w-20">{g.discard.length > 1 && <div className="absolute inset-0 rotate-6 opacity-70"><CardView card={g.discard[g.discard.length - 2]} /></div>}<div key={top.id} className={`absolute inset-0 luno-fly-${g.from}`}><CardView card={top} /></div></div>
          <div className={`luno-chip luno-${g.color}`} title="Current color" />
        </div>
        <p key={g.msg + g.turn} className="luno-msg text-lg font-semibold">{g.msg} <span className="text-muted-foreground">{g.winner === null && (g.dir === 1 ? "↻" : "↺")}</span></p>
        {pending && (
          <div className="flex gap-3 rounded-2xl bg-card p-4">
            <span className="self-center font-bold">Pick a color:</span>
            {(["red", "yellow", "green", "blue"] as Color[]).map((c) => (
              <button key={c} className={`luno-chip luno-${c}`} onClick={() => { setG(play(g, 0, pending, c)); setPending(null); }} />
            ))}
          </div>
        )}
      </section>

      <section className={`mx-auto mt-8 max-w-5xl rounded-3xl bg-card/60 p-4 ${myTurn ? "ring-4 ring-primary" : ""}`}>
        <div className="mb-2 font-bold">Your hand ({g.hands[0].length})</div>
        <div className="flex flex-wrap justify-center gap-2">
          {g.hands[0].map((c) => (
            <CardView key={c.id} card={c} onClick={() => clickCard(c)} playable={myTurn && !pending && canPlay(c, top, g.color)} />
          ))}
        </div>
      </section>
    </main>
  );
}
