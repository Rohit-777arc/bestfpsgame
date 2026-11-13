import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type TouchInput = {
  moveX: number;
  moveY: number;
  lookDX: number;
  lookDY: number;
  firing: boolean;
  jump: boolean;
  aiming: boolean;
};

type StickVisual = { x: number; y: number; dx: number; dy: number };
type MoveVisual = { x: number; y: number };

export function TouchControls({
  input,
  scopedWeapon,
  active,
  onReload,
}: {
  input: TouchInput;
  scopedWeapon: boolean;
  active: boolean;
  onReload: () => void;
}) {
  const movePointer = useRef<number | null>(null);
  const lookPointer = useRef<number | null>(null);
  const lastLook = useRef<{ x: number; y: number } | null>(null);
  const [lookStick, setLookStick] = useState<StickVisual | null>(null);
  const [moveStick, setMoveStick] = useState<MoveVisual>({ x: 0, y: 0 });

  if (!active) return null;

  const updateMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.38;
    const dx = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const dy = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(dx, dy);
    const scale = length > 1 ? 1 / length : 1;
    input.moveX = dx * scale;
    input.moveY = -dy * scale;
    setMoveStick({ x: input.moveX * 30, y: -input.moveY * 30 });
  };

  const updateLook = (event: React.PointerEvent<HTMLDivElement>, rect: DOMRect) => {
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const previous = lastLook.current;
    if (previous) {
      input.lookDX += x - previous.x;
      input.lookDY += y - previous.y;
    }
    lastLook.current = { x, y };
    setLookStick((stick) => {
      if (!stick) return { x, y, dx: 0, dy: 0 };
      const dx = x - stick.x;
      const dy = y - stick.y;
      const length = Math.hypot(dx, dy);
      const scale = length > 44 ? 44 / length : 1;
      return { ...stick, dx: dx * scale, dy: dy * scale };
    });
  };

  const stopLook = () => {
    lookPointer.current = null;
    lastLook.current = null;
    setLookStick(null);
  };

  return (
    <div className="fps-touch-controls fps-touch-controls-active pointer-events-none absolute inset-0 z-20 select-none" aria-label="Mobile game controls">
      <div
        className="pointer-events-auto absolute bottom-[150px] left-5 flex size-28 touch-none items-center justify-center rounded-full border-2 border-foreground/55 bg-background/25 shadow-lg"
        aria-label="Movement joystick"
        onPointerDown={(event) => {
          if (movePointer.current !== null) return;
          movePointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateMove(event);
        }}
        onPointerMove={(event) => {
          if (movePointer.current === event.pointerId) updateMove(event);
        }}
        onPointerUp={(event) => {
          if (movePointer.current !== event.pointerId) return;
          movePointer.current = null;
          input.moveX = 0;
          input.moveY = 0;
          setMoveStick({ x: 0, y: 0 });
        }}
        onPointerCancel={() => {
          movePointer.current = null;
          input.moveX = 0;
          input.moveY = 0;
          setMoveStick({ x: 0, y: 0 });
        }}
      >
        <span
          className="pointer-events-none size-11 rounded-full border-2 border-primary bg-primary/35 shadow-md"
          style={{ transform: `translate(${moveStick.x}px, ${moveStick.y}px)` }}
        />
      </div>

      <div
        className="pointer-events-auto absolute bottom-56 right-0 top-24 w-[48%] touch-none"
        aria-label="Aim joystick"
        onPointerDown={(event) => {
          if (lookPointer.current !== null) return;
          lookPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          lastLook.current = { x, y };
          setLookStick({ x, y, dx: 0, dy: 0 });
        }}
        onPointerMove={(event) => {
          if (lookPointer.current === event.pointerId) {
            updateLook(event, event.currentTarget.getBoundingClientRect());
          }
        }}
        onPointerUp={stopLook}
        onPointerCancel={stopLook}
      >
        {lookStick && (
          <span
            className="pointer-events-none absolute size-[88px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground/50 bg-background/20"
            style={{ left: lookStick.x, top: lookStick.y }}
          >
            <span
              className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/35"
              style={{ transform: `translate(calc(-50% + ${lookStick.dx}px), calc(-50% + ${lookStick.dy}px))` }}
            />
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-[150px] right-4 flex flex-col items-end gap-3">
        <Button
          type="button"
          className="mso-btn pointer-events-auto h-14 min-w-14 touch-none rounded-full px-4 text-sm"
          aria-label="Shoot"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            input.firing = true;
          }}
          onPointerUp={() => { input.firing = false; }}
          onPointerCancel={() => { input.firing = false; }}
          onLostPointerCapture={() => { input.firing = false; }}
        >
          FIRE
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="mso-btn mso-btn-ghost pointer-events-auto size-12 touch-none rounded-full p-0 text-[0.65rem]"
            aria-label="Jump"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              input.jump = true;
            }}
            onPointerUp={() => { input.jump = false; }}
            onPointerCancel={() => { input.jump = false; }}
            onLostPointerCapture={() => { input.jump = false; }}
          >
            JUMP
          </Button>
          {scopedWeapon && (
            <Button
              type="button"
              className="mso-btn mso-btn-ghost pointer-events-auto size-12 touch-none rounded-full p-0 text-[0.65rem]"
              aria-label="Scope"
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                input.aiming = true;
              }}
              onPointerUp={() => { input.aiming = false; }}
              onPointerCancel={() => { input.aiming = false; }}
              onLostPointerCapture={() => { input.aiming = false; }}
            >
              SCOPE
            </Button>
          )}
          <Button
            type="button"
            className="mso-btn mso-btn-ghost pointer-events-auto size-12 touch-none rounded-full p-0 text-xs"
            aria-label="Reload"
            onClick={onReload}
          >
            R
          </Button>
        </div>
      </div>
    </div>
  );
}