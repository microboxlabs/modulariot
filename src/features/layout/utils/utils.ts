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
