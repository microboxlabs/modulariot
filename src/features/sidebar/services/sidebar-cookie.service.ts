import { cookies } from "next/headers";
import type { SidebarCookie } from "./sidebar-cookie.service.types";

const NAME = "sidebar-collapsed";

export const sidebarCookie = {
  get(): SidebarCookie {
    const cookie = cookies().get(NAME);
    const isCollapsed = cookie?.value === "true";

    return { isCollapsed };
  },
  set(value: SidebarCookie) {
    cookies().set(NAME, String(value.isCollapsed));
  },
};
