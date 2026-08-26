"use client";

import { BsStars } from "react-icons/bs";
import { twMerge } from "tailwind-merge";
import { KeyboardShortcutTrigger } from "@/features/common/components/keyboard-shortcut-trigger";
import { useMediaQuery } from "@/features/layout/hooks/use-media-query";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useHarnessChatContext } from "./context/harness-chat-context";

/** Matches the `lg:` breakpoint the panel itself opens at — see the
 * `hidden … lg:flex` wrapper in harness-chat.tsx. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export default function HarnessChatToggleButton({
  dict,
}: Readonly<{ dict?: I18nRecord }>) {
  const { isOpen, toggle } = useHarnessChatContext();
  // Below `lg` the panel is display:none, so this control has nothing to
  // reveal — it would only flip its own pressed/colour state. CSS hides the
  // button (the same lever the panel uses, and no hydration mismatch, unlike
  // returning null off a media query); the query gates only the key
  // listener, which renders nothing either way.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // `dict` is the loose I18nRecord SecuredNavbar already threads to its
  // other children (SpotlightSearch, OrgSwitcher…) — same convention here,
  // not the typed harness-chat-i18n-context, since this button is a sibling
  // of HarnessChat in the tree, not a descendant of its provider.
  const toggleLabel = dict ? tr("harnessChat.ui.toggleButton", dict) : "Toggle harness chat";

  return (
    // ⌘/Ctrl+J toggles the panel — the panel-toggle chord, deliberately not
    // ⌘/Ctrl+C: that one bound the panel to the Copy shortcut, so every copy
    // anywhere in the app (a table cell, a chat response) also opened or
    // closed it.
    <div className="hidden lg:block">
      <KeyboardShortcutTrigger shortcutKey="j" onTrigger={toggle} enabled={isDesktop}>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={isOpen}
          className={twMerge(
            "h-10 w-10 select-none cursor-pointer flex items-center justify-center p-2 rounded-lg border border-transparent transition-all duration-300 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600",
            isOpen
              ? "bg-linear-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)] hover:brightness-105"
              : "bg-gray-100 dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          )}
        >
          <span className="sr-only">{toggleLabel}</span>
          <BsStars
            className={twMerge("h-5 w-5", isOpen ? "text-white" : "text-gray-500 dark:text-gray-400")}
          />
        </button>
      </KeyboardShortcutTrigger>
    </div>
  );
}
