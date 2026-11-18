import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/game/TopBar";
import { useProgress } from "@/components/game/useProgress";

export const Route = createFileRoute("/racing")({
  ssr: false,
  head: () => ({ meta: [{ title: "Gun Racing — Mexican Standof" }] }),
  component: RacingPage,
});

function RacingPage() {
  const p = useProgress();
  const [speed, setSpeed] = useState(0);
  const [nitro, setNitro] = useState(100);
  const [health, setHealth] = useState(1000);
  const [ammo, setAmmo] = useState(60);
  const [title, setTitle] = useState("RACING READY");
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!p.racingUnlocked) return;
    let frame = 0;
    let last = performance.now();
    const down = (event: KeyboardEvent) => (keys.current[event.code] = true);
    const up = (event: KeyboardEvent) => (keys.current[event.code] = false);
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setSpeed((old) => {
        const boost = keys.current.ShiftLeft && nitro > 0;
        const target = keys.current.KeyW ? (boost ? 180 : 120) : 35;
        const next = Math.max(0, Math.min(220, old + (target - old) * dt * 1.8));
        if (boost) setNitro((value) => Math.max(0, value - 20 * dt));
        else setNitro((value) => Math.min(100, value + 4 * dt));
        if (keys.current.KeyA || keys.current.KeyD) setTitle(old > 75 ? "DRIFT x1" : "CORNERING");
        if (keys.current.KeyS) setTitle("BRAKING");
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
    };
  }, [p.racingUnlocked, nitro]);

  if (!p.racingUnlocked) {
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mso-panel rounded-xl p-10">
            <div className="hub-info-kicker">LOCKED EVENT</div>
            <h1 className="mso-display mt-3 text-5xl">GUN RACING</h1>
            <p className="mt-4 text-muted-foreground">Redeem <b>GUNRACE</b> in Codes & Rewards to unlock this mode.</p>
            <Link className="mso-btn mt-6 inline-flex" to="/armory">OPEN CODES</Link>
          </div>
        </main>
      </>
    );
  }

  const fire = () => {
    setAmmo((value) => {
      if (value <= 0) return value;
      setTitle(speed > 110 ? "WRECKED" : "TARGET HIT");
      setHealth((hp) => Math.max(0, hp - 25));
      return value - 1;
    });
  };

  return (
    <>
      <TopBar />
      <main className="racing-shell">
        <div className="racing-road" aria-label="Gun racing track">
          <div className="racing-sky"><span>GUN RACING / NIGHT CIRCUIT</span></div>
          <div className="racing-lane lane-one" />
          <div className="racing-lane lane-two" />
          <div className="racing-rival rival-one"><b>CPU</b><span>1000 HP</span></div>
          <div className="racing-rival rival-two"><b>CPU</b><span>1000 HP</span></div>
          <div className="racing-player">
            <div className="racing-gun" />
            <span>YOU</span>
          </div>
          <div className="racing-pickup nitro-pickup">N₂O</div>
          <div className="racing-pickup ammo-pickup">AMMO</div>
          <div className="racing-pickup med-pickup">+</div>
        </div>
        <div className="racing-title" key={title}>{title}</div>
        <div className="racing-hud">
          <div><span>SPEED</span><strong>{Math.round(speed)} KM/H</strong></div>
          <div><span>NITRO</span><strong>{Math.round(nitro)}%</strong></div>
          <div><span>CAR HP</span><strong>{health}/1000</strong></div>
          <div><span>AMMO</span><strong>{ammo}</strong></div>
        </div>
        <div className="racing-controls">
          <span>W</span> ACCELERATE · <span>A D</span> STEER / DRIFT · <span>SHIFT</span> NITRO · <button type="button" onClick={fire}>FIRE GUN</button>
        </div>
      </main>
    </>
  );
}
