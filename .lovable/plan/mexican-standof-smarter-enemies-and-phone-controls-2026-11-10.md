# Mexican Standof: smarter enemies and phone controls

## What will change

- Give every enemy type a visible gun and ranged attacks, with clear projectile/tracer feedback and fair cooldowns.
- Make dungeon enemies become more capable as waves progress: better aim and attack timing, more deliberate movement, and stronger pressure, while keeping progression bounded and readable. Use lightweight, deterministic in-game behavior rather than paid external AI calls, so play stays responsive and does not spend the user's AI credits.
- Fix the white hit-flash bug so hit and death animations always restore each enemy's original materials.
- Add phone controls: a left movement joystick, a right aiming/look joystick, and touch buttons for shooting and jumping. Keep desktop keyboard and mouse play working, and make the controls fit small screens.

## Implementation outline

1. Extend the pure game rules with wave-based enemy behavior values and tests proving later dungeon waves increase enemy capability without exceeding the chosen bounds; preserve existing difficulty payouts and training behavior.
2. Update the shared arena and enemy actors to show guns and implement the ranged attacks for all enemy tiers. Scale their behavior by wave, preserve co-op targeting, and give players visible warning/feedback for incoming shots.
3. Repair hit-flash/material restoration across both living and dying enemies, including being killed while flashing.
4. Route keyboard, mouse, and touch through the same game actions. Add mobile movement and aiming joysticks plus shoot/jump buttons, while separating touch play from pointer-lock requirements.
5. Verify the key gameplay flows on desktop and mobile, run the affected game-rule tests, and resolve any preview/build errors found.

## Technical notes

Changes are expected in the arena and actor code, pure wave rules and their tests, plus a focused touch-control layer. No database or account changes are needed. The existing enemy system is wave-based and currently chases and attacks at close range; the reported white flash can persist when an enemy dies because the dead-enemy update exits before restoring its materials. Mobile gameplay currently lacks touch movement and aiming and depends on pointer lock.
