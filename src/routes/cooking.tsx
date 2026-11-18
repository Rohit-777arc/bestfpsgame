import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/game/TopBar";
import { PageShell } from "@/components/game/Picker";

export const Route = createFileRoute("/cooking")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Cooking Battle — Mexican Standof" }, { name: "description", content: "A fast one-minute kitchen cook-off." }],
  }),
  component: CookingPage,
});

const ORDERS = [
  { name: "TACO STACK", ingredients: ["Tortilla", "Beef", "Pepper"], color: "#efb84d" },
  { name: "GREEN BOWL", ingredients: ["Rice", "Avocado", "Herbs"], color: "#78b86b" },
  { name: "HOT BURGER", ingredients: ["Bun", "Steak", "Sauce"], color: "#dd6a48" },
];

function CookingPage() {
  const [seconds, setSeconds] = useState(60);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [order, setOrder] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const current = ORDERS[order];
  const addIngredient = (ingredient: string) => {
    if (!running) return;
    setSelected((old) => [...old, ingredient].slice(-3));
  };
  const serve = () => {
    if (!running) return;
    const correct = current.ingredients.every((ingredient) => selected.includes(ingredient)) &&
      selected.length === current.ingredients.length;
    if (correct) {
      setScore((value) => value + 100 + combo * 25);
      setCombo((value) => value + 1);
    } else {
      setCombo(0);
    }
    setSelected([]);
    setOrder((value) => (value + 1) % ORDERS.length);
  };
  const start = () => {
    setSeconds(60);
    setScore(0);
    setCombo(0);
    setSelected([]);
    setOrder(0);
    setRunning(true);
  };

  return (
    <>
      <TopBar />
      <PageShell title="COOKING BATTLE" kicker="ONE-MINUTE COOK-OFF">
        <div className="cooking-layout">
          <aside className="cooking-order" style={{ borderTopColor: current.color }}>
            <span>ORDER {order + 1}</span>
            <strong>{current.name}</strong>
            <div>{current.ingredients.map((item) => <em key={item}>{item}</em>)}</div>
          </aside>
          <section className="cooking-counter" aria-label="Cooking counter">
            <div className="cooking-score"><span>TIME</span><strong>{seconds}s</strong></div>
            <div className="cooking-score"><span>SCORE</span><strong>{score}</strong></div>
            <div className="cooking-score"><span>COMBO</span><strong>x{combo}</strong></div>
            <div className="cooking-pan">
              {selected.length ? selected.map((item, i) => <span key={`${item}-${i}`}>{item}</span>) : <b>EMPTY PLATE</b>}
            </div>
            <div className="cooking-ingredients">
              {["Tortilla", "Beef", "Pepper", "Rice", "Avocado", "Herbs", "Bun", "Steak", "Sauce"].map((item) => (
                <button key={item} type="button" onClick={() => addIngredient(item)} disabled={!running}>{item}</button>
              ))}
            </div>
          </section>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="mso-btn" onClick={start}>{running ? "RESTART" : seconds === 0 ? "PLAY AGAIN" : "START COOK-OFF"} ▸</button>
          <button type="button" className="mso-btn mso-btn-ghost" onClick={serve} disabled={!running}>SERVE ORDER</button>
        </div>
      </PageShell>
    </>
  );
}
