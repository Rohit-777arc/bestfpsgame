import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/game/TopBar";
import { PageShell, Picker } from "@/components/game/Picker";

export const Route = createFileRoute("/vehicles")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Road Vehicles — Mexican Standof" },
      { name: "description", content: "Race street cars and hit jumps on motorbikes." },
    ],
  }),
  component: VehiclesPage,
});

const VEHICLES = [
  { id: "car", title: "STREET CAR", sub: "Drift through checkpoints and chase rivals.", icon: "C" },
  { id: "bike", title: "MOTORBIKE", sub: "Time trials, wheelies and huge jumps.", icon: "B" },
] as const;

type VehicleId = (typeof VEHICLES)[number]["id"];

function VehiclesPage() {
  const [vehicle, setVehicle] = useState<VehicleId>("car");
  const [speed, setSpeed] = useState(0);
  const [mission, setMission] = useState("MISSION READY");
  const [health, setHealth] = useState(100);
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (event: KeyboardEvent) => { keys.current[event.code] = true; };
    const up = (event: KeyboardEvent) => { keys.current[event.code] = false; };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const accelerating = keys.current.KeyW || keys.current.ArrowUp;
      const braking = keys.current.KeyS || keys.current.ArrowDown;
      setSpeed((old) => Math.max(0, Math.min(vehicle === "bike" ? 260 : 220,
        old + ((accelerating ? 30 : braking ? -45 : -8) * dt))));
      if (keys.current.KeyA || keys.current.KeyD || keys.current.ArrowLeft || keys.current.ArrowRight) {
        setMission(speed > 20 ? "STEERING" : "POWERING UP");
      } else if (keys.current.Space) {
        setMission("BOOST");
      } else {
        setMission(accelerating ? "ON THE MOVE" : "MISSION READY");
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
    };
  }, [vehicle, speed]);

  const selected = VEHICLES.find((item) => item.id === vehicle)!;
  return (
    <>
      <TopBar />
      <PageShell title="ROAD VEHICLES" kicker="CHOOSE YOUR MACHINE">
        <Picker
          label="VEHICLE"
          value={vehicle}
          onChange={(id) => { setVehicle(id as VehicleId); setSpeed(0); setHealth(100); }}
          options={VEHICLES.map((item) => ({ id: item.id, title: item.title, sub: item.sub }))}
        />
        <section className="vehicle-stage" aria-label={`${selected.title} mission`}>
          <div className="vehicle-grid" />
          <div className={`vehicle-object vehicle-${vehicle}`}>
            <span>{selected.icon}</span>
          </div>
          <div className="vehicle-hud">
            <div><span>SPEED</span><strong>{Math.round(speed)} KM/H</strong></div>
            <div><span>MISSION</span><strong>{mission}</strong></div>
            <div><span>INTEGRITY</span><strong>{health}%</strong></div>
          </div>
          <div className="vehicle-controls">
            <span>W/S</span> THROTTLE · <span>A/D</span> STEER · <span>SPACE</span> ACTION
          </div>
        </section>
      </PageShell>
    </>
  );
}
