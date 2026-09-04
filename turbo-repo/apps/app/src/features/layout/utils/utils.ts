import { MessagesType } from "@/features/i18n/i18n.service.types";
import { NavBarMessages } from "../components/secured-navbar/secured-navbar.types";

export function buildNavBarMessages({
  messages: dict,
}: MessagesType): NavBarMessages {
  return {
    signOutLabel: dict("layout.secured.signout"),
    search: dict("layout.secured.search"),
  };
}

/**
 * Server-only flag: kept off NEXT_PUBLIC_ so it never ships to the client
 * bundle. Gates both the spotlight search UI and the harness-chat panel —
 * when false/unset, neither mounts at all (no trigger button, no Cmd+K
 * listener, no chat toggle) rather than rendering disabled/broken UI.
 */
export function isHarnessUiEnabled(): boolean {
  return process.env.ENABLE_SEARCHBAR === "true";
}

export function pathNameWithoutLanguage(pathname: string): string {
  return "/" + pathname.split("/").slice(2).join("/");
}

/**
 * Segment-aware prefix match: returns true only when `pathname` equals
 * `href` (ignoring query strings) or is a child segment of it.
 * e.g. isSegmentPrefix("/users/settings", "/users/settings-archive") → false
 *      isSegmentPrefix("/users/settings", "/users/settings/profile") → true
 */
export function isSegmentPrefix(href: string, pathname: string): boolean {
  const hrefPath = href.split("?")[0];
  if (pathname === hrefPath) return true;
  return pathname.startsWith(hrefPath + "/");
}
