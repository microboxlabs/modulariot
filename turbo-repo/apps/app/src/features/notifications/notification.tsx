/* eslint-disable */
import { toast } from "sonner";
import React from "react";

type NotificationAction =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "warning"; message: string }
  | { type: "info"; message: string }
  | { type: "default"; message: string }
  | { type: "description"; message: string; description: string }
  | {
      type: "action";
      label: string;
      message: string | React.ReactNode;
      onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    }
  | {
      type: "promise";
      promise: Promise<any> | (() => Promise<any>);
      loading: string;
      ok: string;
      error: string;
    };

/**
 * # Show Notification
 * This function displays an especific type of notification based entirely on the action type
 *
 * Remember that this MUST be used in a client component since it should be triggered by
 * an action, submit, button or others.
 *
 * The main sintax is ShowNotification({ type: "success", message: "this is an example" })
 *
 * For special cases like the description, action and promise, the main structure follows the examples of the
 * official documentation in: https://sonner.emilkowal.ski/
 *
 */
export function ShowNotification(action: NotificationAction) {
  switch (action.type) {
    case "success":
      toast.success(action.message);
      break;
    case "error":
      toast.error(action.message);
      break;
    case "warning":
      toast.warning(action.message);
      break;
    case "info":
      toast.warning(action.message);
      break;
    case "description":
      toast.message(action.message, { description: action.description });
      break;
    case "action":
      toast(action.message, {
        action: {
          label: action.label,
          onClick: action.onClick,
        },
      });
      break;
    case "promise":
      toast.promise(action.promise, {
        loading: action.loading,
        success: action.ok,
        error: action.error,
      });
      break;
    default:
      toast(action.message);
  }
}

export function CustomNotification(children: React.ReactNode) {
  // No height/minHeight overrides here: sonner clamps the height of stacked
  // (non-front) toasts via its own stylesheet to collapse them behind the
  // newest one, but an inline style always wins over that rule, so setting
  // height here would keep every stacked toast at full content height and
  // stop them from compacting.
  toast(children, {
    style: {
      // A fixed 60vw, not fit-content: fit-content shrinks to the intrinsic
      // size of the content, which was leaving these toasts much narrower
      // than intended regardless of the min/max-width clamps.
      width: "60vw",
      padding: "0",
      // sonner's toast-list container is only ~356px wide and centers
      // itself on screen based on that width, so a toast this much wider
      // than its container needs its own centering. `left:0/right:0` with
      // auto margins does NOT work here: per the CSS2.1 abs-position
      // algorithm, auto margins are forbidden from going negative, so once
      // the toast is wider than its container the browser pins the left
      // edge at 0 and the rest overflows off the right — which is exactly
      // the "starts where it used to, just wider" bug that was reported.
      // `left:50%` + `translateX(-50%)` sidesteps that: transforms have no
      // such restriction, and the -50% shift is relative to the toast's own
      // width, so it centers correctly regardless of the container's width.
      // `var(--y)` is sonner's own vertical slide/stack transform (set by
      // its stylesheet); chaining it here keeps that animation intact
      // instead of clobbering it with our own transform.
      left: "50%",
      transform: "var(--y) translateX(-50%)",
      // sonner's own stylesheet gives every toast a default "card" look
      // (background, border, border-radius, shadow) via its
      // [data-styled="true"] rule, since it doesn't know this toast is
      // fully custom-rendered. Left alone, that produces a border/background
      // wrapped around whatever border/background the custom JSX itself
      // draws — a border nested inside another border. Neutralizing it here
      // makes the <li> a plain, invisible positioning wrapper so only the
      // custom content's own styling shows.
      background: "transparent",
      border: "none",
      boxShadow: "none",
      borderRadius: 0,
    },
  });
}
