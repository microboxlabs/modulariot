"use client";

/**
 * A card people click, select and act on: the dashboards explorer's cards
 * and the Storytelling cards share it.
 *
 * The card draws the frame and places its parts; what goes in them is the
 * caller's. The selector sits on the left and the actions on the right. With
 * the "media" layout both float over the corners of the preview, with the
 * "row" layout they sit in line, at either end of the tile.
 *
 * The click that opens the card is the caller's too: put
 * `INTERACTIVE_CARD_TARGET` on its link or button and that element's
 * `::after` stretches over the whole card. The selector and the actions stay
 * above it, so they can still be clicked.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import SelectBox from "../select-box";

/** Makes a link or button inside the card cover the whole card. */
export const INTERACTIVE_CARD_TARGET =
  "focus:outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-blue-500";

const TONE = {
  plain:
    "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600",
  selected: "border-blue-500 bg-white dark:border-blue-500 dark:bg-gray-800",
  drop: "border-primary-400 bg-primary-50 ring-1 ring-primary-400 dark:bg-primary-900/40",
} as const;

export interface InteractiveCardSelection {
  checked: boolean;
  /** The checkbox's accessible name, e.g. `Select "Fleet"`. */
  label: string;
  onToggle: () => void;
}

export interface InteractiveCardProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> {
  /** "li" inside a list of cards; "div" otherwise. */
  as?: "li" | "div";
  /** "media": a preview on top, the body under it. "row": a short tile. */
  layout?: "media" | "row";
  selected?: boolean;
  /** Something is being dragged over it and would land in it. */
  dropTarget?: boolean;
  /** Drawn faint, e.g. while it is being moved. */
  faded?: boolean;
  /** The checkbox on the left; left out, the card can't be selected. */
  selection?: InteractiveCardSelection;
  /** Buttons or badges on the right, e.g. a star. */
  actions?: ReactNode;
  /** The preview on top, in the "media" layout. */
  media?: ReactNode;
  children: ReactNode;
}

function Selector({
  selection,
  layout,
}: Readonly<{
  selection: InteractiveCardSelection;
  layout: "media" | "row";
}>) {
  return (
    <span
      data-card-selector
      className={twMerge(
        "z-10 flex",
        layout === "media" ? "absolute left-2 top-2" : "relative shrink-0",
        // Shown on hover and focus, and always once checked. In a row it
        // keeps its space, so the content doesn't move when it shows.
        !selection.checked &&
          "invisible group-focus-within:visible group-hover:visible"
      )}
    >
      <SelectBox
        checked={selection.checked}
        label={selection.label}
        onToggle={selection.onToggle}
      />
    </span>
  );
}

export default function InteractiveCard({
  as: Root = "div",
  layout = "media",
  selected = false,
  dropTarget = false,
  faded = false,
  selection,
  actions,
  media,
  children,
  className,
  ...rest
}: Readonly<InteractiveCardProps>) {
  let tone: string = TONE.plain;
  if (dropTarget) tone = TONE.drop;
  else if (selected) tone = TONE.selected;
  const isRow = layout === "row";
  const actionsSlot = actions && (
    <span
      data-card-actions
      className={twMerge(
        "z-10 flex items-center gap-1",
        isRow ? "relative shrink-0" : "absolute right-1.5 top-1.5"
      )}
    >
      {actions}
    </span>
  );
  return (
    <Root
      {...rest}
      className={twMerge(
        // No overflow-hidden: a menu inside the card that doesn't portal
        // would be cut off. The preview rounds its own top corners instead.
        "group relative rounded-xl border transition",
        isRow ? "flex h-16 items-center gap-3 px-3" : "flex flex-col",
        tone,
        faded && "opacity-40",
        className
      )}
    >
      {selection && <Selector selection={selection} layout={layout} />}
      {!isRow && media && (
        <div className="overflow-hidden rounded-t-[11px]">{media}</div>
      )}
      {isRow ? <div className="flex min-w-0 flex-1">{children}</div> : children}
      {actionsSlot}
    </Root>
  );
}
