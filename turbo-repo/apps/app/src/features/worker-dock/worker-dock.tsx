"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useHarnessChatContext } from "@/features/harness-chat/context/harness-chat-context";
import { WORKERS, findWorker } from "./workers";
import { WORKER_COLORS } from "./worker-colors";
import { WorkerOrbView } from "./worker-orb-view";
import { WorkerBadge } from "./worker-badge";

// Keep the launched orb playing its "disappear" for this long; the flat badge
// underneath is already expanding in while it goes.
const EXIT_MS = 420;
// How long the returning orb is given to play its "appear".
const RETURN_MS = 780;
// ...and when, within that, the disc it lands on top of starts fading away.
const BADGE_FADE_AT_MS = 240;

type Hover = { id: string; rect: DOMRect };

/** Name pill shown left of a hovered dock orb, in that worker's colour — fades
 *  + eases in from the button. */
function WorkerTooltip({
  name,
  role,
  color,
  rect,
}: Readonly<{ name: string; role: string; color: string; rect: DOMRect }>) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-60 flex items-baseline gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-black/10 transition-[opacity,transform] duration-200 ease-out [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
      style={{
        left: rect.left - 10,
        top: rect.top + rect.height / 2,
        backgroundColor: color,
        transformOrigin: "right center",
        opacity: shown ? 1 : 0,
        transform: shown
          ? "translate(-100%, -50%) scale(1)"
          : "translate(calc(-100% + 7px), -50%) scale(0.94)",
      }}
    >
      <span>{name}</span>
      <span className="text-[11px] font-normal text-white/75">{role}</span>
    </div>,
    document.body,
  );
}

/**
 * The always-on vertical strip on the far right of the secured layout — one
 * orb button per worker (see `workers.ts`). Clicking a worker sends its orb
 * off into the chat (a random disappear from `orb-animations.ts`, leaving a
 * flat badge); closing the chat brings it back with a random appear. Others
 * recede while a persona is open. Hovering shows the worker's name. Desktop-only.
 */
export function WorkerDock({ dict }: Readonly<{ dict: I18nRecord }>) {
  const { isOpen, activeWorkerId, openWithWorker, close } = useHarnessChatContext();
  const [hover, setHover] = useState<Hover | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [badgeFading, setBadgeFading] = useState(false);

  // The worker whose orb is currently "away" in the chat — only while the panel
  // is actually open.
  const awayId = isOpen ? activeWorkerId : null;
  const someAway = awayId !== null;

  // Read the freshest open/persona state at click time (not a render closure),
  // and swallow a stray second activation so a click can't open-then-close.
  const liveState = useRef({ isOpen, activeWorkerId });
  liveState.current = { isOpen, activeWorkerId };
  const lockRef = useRef(false);

  const handleClick = (id: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setTimeout(() => {
      lockRef.current = false;
    }, 220);

    const { isOpen: open, activeWorkerId: active } = liveState.current;
    if (open && active === id) {
      close();
      return;
    }
    setExitingId(id);
    openWithWorker(id);
    window.setTimeout(
      () => setExitingId((x) => (x === id ? null : x)),
      EXIT_MS,
    );
  };

  // When a worker stops being away (chat closed, or "back to the harness") its
  // orb plays an appear back in the button. Flip `returningId` *during render*
  // the instant `awayId` clears — not in an effect — so there's no frame where
  // the disc is neither "away" nor "returning" and unmounts + re-plays its
  // grow-in.
  const prevAway = useRef(awayId);
  if (prevAway.current !== awayId) {
    const prev = prevAway.current;
    prevAway.current = awayId;
    if (awayId) {
      if (returningId) setReturningId(null);
      if (badgeFading) setBadgeFading(false);
    } else if (prev) {
      setReturningId(prev);
      setBadgeFading(false);
    }
  }
  useEffect(() => {
    if (!returningId) return;
    // once the orb has landed back on the disc, fade the disc out under it
    const fade = setTimeout(() => setBadgeFading(true), BADGE_FADE_AT_MS);
    const done = setTimeout(() => {
      setReturningId(null);
      setBadgeFading(false);
    }, RETURN_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [returningId]);

  const clearHover = (id: string) =>
    setHover((h) => (h?.id === id ? null : h));
  const hoverWorker = findWorker(hover?.id);

  return (
    <div
      aria-label={tr("harnessChat.ui.workerDock.label", dict)}
      className="mt-16 mb-12 hidden w-16 shrink-0 flex-col items-center gap-3 overflow-y-auto border-l border-gray-200 bg-white py-4 dark:border-gray-700 dark:bg-gray-900 lg:flex"
    >
      {WORKERS.map((w) => {
        const hex = WORKER_COLORS[w.color].hex;
        const isAway = awayId === w.id;
        const isExiting = exitingId === w.id;
        const isReturning = returningId === w.id;
        // orb is on-screen in the button unless it's fully away
        const showOrb = !isAway || isExiting;
        const orbMode = isExiting
          ? "exit"
          : hover?.id === w.id
            ? "hover"
            : "idle";

        return (
          <button
            key={w.id}
            type="button"
            data-worker-dock-btn={w.id}
            onClick={(e) => {
              e.currentTarget.blur();
              // clicking the open persona again closes the chat; otherwise it
              // sends this worker's orb off into the chat
              handleClick(w.id);
            }}
            onPointerEnter={(e) =>
              setHover({ id: w.id, rect: e.currentTarget.getBoundingClientRect() })
            }
            onPointerLeave={() => clearHover(w.id)}
            onFocus={(e) =>
              setHover({ id: w.id, rect: e.currentTarget.getBoundingClientRect() })
            }
            onBlur={() => clearHover(w.id)}
            aria-pressed={isAway}
            aria-label={tr("harnessChat.ui.workerDock.openWorker", dict, { name: w.name })}
            className={twMerge(
              "flex h-11 w-11 items-center justify-center overflow-hidden rounded-full transition-all duration-200",
              "outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-500",
              isAway
                ? "bg-gray-100 ring-2 ring-gray-300 dark:bg-gray-800 dark:ring-gray-600"
                : "hover:bg-gray-100 dark:hover:bg-gray-800",
              // while a persona is open the *others* recede; the open one keeps
              // full colour
              someAway && !isAway && "opacity-35 hover:opacity-100",
            )}
          >
            <span className="relative flex h-10 w-10 items-center justify-center">
              {(isAway || isReturning) && (
                // the disc the character left behind — sits here while the orb
                // is away, then fades out as the returning orb lands on it
                <WorkerBadge
                  color={hex}
                  leaving={isReturning && badgeFading}
                  className="absolute inset-0 m-auto h-9 w-9"
                />
              )}
              {showOrb && (
                <WorkerOrbView
                  color={hex}
                  mode={orbMode}
                  entrance={isReturning}
                  className="absolute inset-0 h-full w-full"
                />
              )}
            </span>
          </button>
        );
      })}

      {hover && hoverWorker && hover.id !== awayId && (
        <WorkerTooltip
          key={hover.id}
          name={hoverWorker.name}
          role={hoverWorker.role}
          color={WORKER_COLORS[hoverWorker.color].hex}
          rect={hover.rect}
        />
      )}
    </div>
  );
}
