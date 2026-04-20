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
