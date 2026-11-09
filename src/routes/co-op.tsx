import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { TopBar } from "@/components/game/TopBar";
import { MAP_SWATCH, PageShell, Picker } from "@/components/game/Picker";
import { useProgress } from "@/components/game/useProgress";
import { Arena } from "@/components/fps/Arena";
import { MAPS, MAP_IDS, type MapId } from "@/game/sim/maps";
import { awardWave } from "@/game/progress";
import {
  makeRoomCode,
  playerId,
  sendEvent,
  useGameChannel,
  type NetBus,
  type RoomMode,
  type RosterEntry,
} from "@/game/net";

export const Route = createFileRoute("/co-op")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Co-op & 1v1 Rooms — Mexican Standof" },
      { name: "description", content: "Create a room, share the 4-letter code, and team up against waves or duel your friend 1v1." },
      { property: "og:title", content: "Co-op & 1v1 Rooms — Mexican Standof" },
      { property: "og:description", content: "Share a room code and play with a friend: co-op waves or a 1v1 duel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoopPage,
});

function CoopPage() {
  const p = useProgress();
  const [code, setCode] = useState(() => {
    if (typeof window === "undefined") return "";
    const c = new URLSearchParams(window.location.search).get("room");
    return c && /^[A-Z]{4}$/i.test(c) ? c.toUpperCase() : "";
  });
  const [joinInput, setJoinInput] = useState("");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [map, setMap] = useState<MapId>("desert");
  const [mode, setMode] = useState<RoomMode>("coop");
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const bus = useRef<NetBus>({});
  const runId = useRef<string | null>(null);
  const createdRef = useRef(false);

  const [created, setCreated] = useState(false);
  const host = created;

  const channelRef = useGameChannel(code, p.name, {
    onState: (s) => bus.current.onState?.(s),
    onRoster: (r) => {
      setRoster(r);
      // re-announce lobby so newcomers see the host's picks
      if (createdRef.current) sendEvent(channelRef.current, { type: "lobby", from: playerId(), map, mode });
    },
    onEvent: (e) => {
      if (e.type === "lobby") {
        setMap(e.map as MapId);
        setMode(e.mode);
      } else if (e.type === "start") {
        setMap(e.map as MapId);
        setMode(e.mode);
        runId.current = null;
        setPlaying(true);
      }
      bus.current.onEvent?.(e);
    },
  });

  const pick = (m: MapId, md: RoomMode) => {
    setMap(m);
    setMode(md);
    sendEvent(channelRef.current, { type: "lobby", from: playerId(), map: m, mode: md });
  };

  const leave = () => {
    setPlaying(false);
    setCode("");
    createdRef.current = false;
    setCreated(false);
    setRoster([]);
    window.history.replaceState(null, "", "/co-op");
  };

  if (playing && code) {
    return (
      <Arena
        mode={mode}
        map={map}
        difficulty="normal"
        weapon={p.equipped}
        playerName={p.name}
        credits={p.credits}
        net={{ channelRef, bus, roster }}
        onWaveCleared={
          mode === "coop"
            ? async (wave) => {
                const res = await awardWave(map, "normal", wave, runId.current);
                runId.current = res.runId;
                return res.awarded;
              }
            : () => 0
        }
        onExit={() => setPlaying(false)}
      />
    );
  }

  if (!code) {
    return (
      <>
        <TopBar />
        <PageShell title="CO-OP & 1v1" kicker="PLAY WITH A FRIEND">
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="mso-card p-6">
              <h3 className="mso-display mb-2 text-2xl">CREATE ROOM</h3>
              <p className="mb-4 text-muted-foreground">Get a 4-letter code and send it to your friend.</p>
              <button type="button" className="mso-btn text-xl" onClick={() => { createdRef.current = true; setCreated(true); setCode(makeRoomCode()); }}>
                CREATE ▸
              </button>
            </section>
            <section className="mso-card p-6">
              <h3 className="mso-display mb-2 text-2xl">JOIN ROOM</h3>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (/^[A-Z]{4}$/.test(joinInput)) setCode(joinInput);
                }}
              >
                <input
                  aria-label="Room code"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
                  placeholder="ABCD"
                  className="mso-display w-40 rounded-lg border-[3px] border-[var(--mso-ink)] bg-background px-3 py-2 text-2xl tracking-widest"
                />
                <button type="submit" className="mso-btn text-xl" disabled={joinInput.length !== 4}>
                  JOIN
                </button>
              </form>
            </section>
          </div>
        </PageShell>
      </>
    );
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/co-op?room=${code}` : "";
  const ready = roster.length >= 2;

  return (
    <>
      <TopBar />
      <PageShell title="ROOM LOBBY" kicker={host ? "YOU ARE HOST" : "WAITING FOR HOST"}>
        <section className="mso-card flex flex-wrap items-center gap-4 p-6">
          <div>
            <div className="text-sm font-bold text-muted-foreground">ROOM CODE</div>
            <div className="mso-display text-6xl tracking-[0.3em]" data-testid="room-code">{code}</div>
          </div>
          <button
            type="button"
            className="mso-btn mso-btn-ghost"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true), () => {});
            }}
          >
            {copied ? "LINK COPIED" : "COPY INVITE LINK"}
          </button>
          <button type="button" className="mso-btn mso-btn-ghost" onClick={leave}>LEAVE</button>
        </section>

        <section>
          <h3 className="mso-display mb-2 text-xl text-primary">PLAYERS ({roster.length})</h3>
          <ul className="flex flex-wrap gap-2">
            {roster.map((r) => (
              <li key={r.id} className="mso-chip">
                {r.name}{r.id === playerId() ? " (you)" : ""}
              </li>
            ))}
            {!ready && <li className="text-muted-foreground">Waiting for your friend to join…</li>}
          </ul>
        </section>

        <section>
          <h3 className="mso-display mb-2 text-xl text-primary">MODE</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["coop", "duel"] as RoomMode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={!host}
                onClick={() => pick(map, m)}
                className={`mso-card p-4 text-left ${mode === m ? "mso-sel" : ""} disabled:opacity-70`}
              >
                <div className="mso-display text-xl">{m === "coop" ? "CO-OP WAVES" : "1v1 DUEL"}</div>
                <div className="text-sm text-muted-foreground">
                  {m === "coop" ? "Fight waves together. Earn credits." : "First to 5 kills wins."}
                </div>
              </button>
            ))}
          </div>
        </section>

        <Picker
          label="MAP"
          value={map}
          onChange={(m) => host && pick(m, mode)}
          options={MAP_IDS.map((id) => ({ id, title: MAPS[id].name, swatch: MAP_SWATCH[id], locked: !host }))}
        />

        <div className="flex items-center gap-4">
          {host ? (
            <button
              type="button"
              className="mso-btn text-2xl"
              disabled={mode === "duel" && !ready}
              onClick={() => {
                sendEvent(channelRef.current, { type: "start", from: playerId(), map, mode });
                runId.current = null;
                setPlaying(true);
              }}
            >
              START ▸
            </button>
          ) : (
            <span className="font-bold text-muted-foreground">The host will start the match.</span>
          )}
          {host && mode === "duel" && !ready && <span className="text-muted-foreground">Duel needs 2 players.</span>}
        </div>
      </PageShell>
    </>
  );
}
