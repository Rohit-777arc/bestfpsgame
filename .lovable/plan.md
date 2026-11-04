# Mexican Standof — Game Hub Plan

Turn the single desert range into **Mexican Standof**, a full game website: a hub with a Dungeon mode (waves of enemies, easy → hard) that pays out credits, an Armory to buy weapons, 3 maps, a Training mode to sharpen aim, and online co-op where one player creates a room, gets a code, and a friend joins with that code.

## What you'll get (pages)

- **`/` — Hub**: hero with the MEXICAN STANDOF logo, big cards for Dungeon / Training / Co-op, credit balance in the header, links to the Armory and map showcase.
- **`/play` — Dungeon**: pick a map + difficulty, then fight waves that grow bigger and faster. Clearing a wave pays credits (Easy 5/wave, Normal 10, Hard 20). Die and the run ends; you keep the credits you earned.
- **`/armory` — Weapons shop**: buy with credits. 5 weapons, each with damage / fire rate / mag / spread / price:
  1. Scout Pistol (free starter), 2. Vector SMG, 3. Riot Shotgun, 4. Marksman Rifle, 5. Longbow Sniper (uses the existing right-click scope).
- **`/train` — Training**: aim drills (pop-up targets, moving dummies) with a difficulty slider — pure practice, no credit risk.
- **`/co-op` — Play with a friend**: "Create room" shows a 4-letter code; your friend enters it (or opens your share link) and you spawn in the same map fighting the same waves.
- **Maps (3)**: Desert Dunes (current look), Neon Night (dark city, glowing signs), Frozen Base (snow, cold blue light). Pickable in every mode.

## How progress works

- First visit you're asked once: **create an account** (email + password) or **play as a guest**. Guests get auto-numbered names (Guest 482) — no email needed, progress saves in the browser. Accounts save everything on the server so credits follow them to any device. A guest can claim an account later and keep their credits.

## Build order

1. **Enable Lovable Cloud** — needed for saving credits, weapon ownership, accounts, and the co-op room channel.
2. **Database**: `profiles` (name, credits), `profile_weapons` (owned guns), `runs` (dungeon results for a personal best). Row-level security so players only touch their own data; credits are added by a server function after a wave clears.
3. **Game engine refactor**: split today's single-file game into rules modules (weapons, enemies, waves, scoring) plus per-map environment configs, so all modes share one engine. Refactor only the game — current look and controls (WASD, jump, sprint, right-click scope) stay.
4. **Dungeon wave mode**: waves spawn more/faster/tougher dummies with higher tiers; wave counter and credit payout on the HUD.
5. **Armory**: buy weapons, equip one, prices and stats above; weapon model changes in hand.
6. **Maps**: lighting/ground/props presets — same engine, three moods.
7. **Training mode**: reuse the engine with unlimited time and target-focused drills.
8. **Co-op**: room codes over the realtime channel (position/heading at ~8 Hz, hits and wave events as instant messages); shared wave state so you fight together; verified with two browser clients before handing over.
9. **Hub pages, guest/account flow, polish, final two-client + playtest check.**

## Technical notes

- Routes under `src/routes/` (TanStack Start); game stays `ssr: false` — three.js never runs on the server.
- **GUI in the style of Roblox Rivals** — bold blocky shooter HUD and menus: big health / ammo / credits counters, a killfeed, weapon loadout cards, and chunky mode-select cards on the hub — all applied to this game's own idea, modes, maps and credits economy.
- **No errors left behind**: every build is checked clean, and each finished mode is play-tested in the running game before it counts as done.
- Game logic in plain TypeScript modules with no React/three imports, unit-tested with vitest (wave payout math, weapon stats, wave scaling).
- Realtime co-op is client-authoritative casual play: fine for friends sharing a code, not anti-cheat proof. Rooms cap at 8 players; the network tick is kept under the project message budget.
- Every page gets its own title/description metadata.

## What I can't check here

The sandbox has no GPU, speakers or a real mouse, so real frame rate, gun feel and zoom feel need your device. Co-op sync I verify with two simulated browsers; two real devices on different networks is the final test.
