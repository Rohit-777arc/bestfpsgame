// Casual online play over a realtime broadcast channel: room codes,
// presence roster, player state sync at a fixed tick, and instant events.

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NetState = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  ry: number; // yaw
  hp: number;
  weapon: string;
};

export type RoomMode = "coop" | "duel";

export type NetEvent =
  | { type: "kill"; from: string; name: string; enemyId: number; wave: number; tier: string }
  | { type: "wave"; from: string; wave: number; seed: number }
  | { type: "duelhit"; from: string; to: string; dmg: number }
  | { type: "frag"; from: string; killer: string; killerName: string; victimName: string }
  | { type: "lobby"; from: string; map: string; mode: RoomMode }
  | { type: "start"; from: string; map: string; mode: RoomMode }
  | { type: "restart"; from: string };

export type RosterEntry = { id: string; name: string };

let cachedId: string | null = null;
export function playerId(): string {
  if (!cachedId) {
    try {
      cachedId = crypto.randomUUID();
    } catch {
      cachedId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }
  return cachedId;
}

export function makeRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

/** Listeners the game installs; the room component forwards to them. */
export type NetBus = {
  onState?: ((s: NetState) => void) | undefined;
  onEvent?: ((e: NetEvent) => void) | undefined;
};

type Handlers = {
  onState: (s: NetState) => void;
  onRoster: (roster: RosterEntry[]) => void;
  onEvent: (e: NetEvent) => void;
};

/**
 * One channel per room, subscribed exactly once and always torn down.
 * Handlers flow through a ref so the effect depends only on the room code.
 */
export function useGameChannel(roomCode: string, name: string, handlers: Handlers) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (!roomCode) return;
    const channel = supabase.channel(`mso:${roomCode}`, {
      config: { broadcast: { self: false }, presence: { key: playerId() } },
    });
    channel
      .on("broadcast", { event: "state" }, ({ payload }) => {
        const s = payload as NetState;
        if (s.id !== playerId()) h.current.onState(s);
      })
      .on("broadcast", { event: "event" }, ({ payload }) => {
        h.current.onEvent(payload as NetEvent);
      })
      .on("presence", { event: "sync" }, () => {
        const roster = Object.entries(channel.presenceState<{ name: string }>()).map(([id, metas]) => ({
          id,
          name: metas[0]?.name ?? "player",
        }));
        h.current.onRoster(roster);
      })
      .subscribe((status) => {
        console.log("[net] channel:", status);
        if (status === "SUBSCRIBED") channel.track({ name });
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // name is captured at subscribe time; only the room identity re-runs this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  return channelRef;
}

export function sendState(channel: RealtimeChannel | null, s: NetState) {
  channel?.send({ type: "broadcast", event: "state", payload: s });
}

export function sendEvent(channel: RealtimeChannel | null, e: NetEvent) {
  channel?.send({ type: "broadcast", event: "event", payload: e });
}

/** The lexicographically smallest id in a roster owns wave progression. */
export function isCoordinator(roster: { id: string }[]): boolean {
  const ids = roster.map((p) => p.id).sort();
  return ids.length === 0 || ids[0] === playerId();
}
