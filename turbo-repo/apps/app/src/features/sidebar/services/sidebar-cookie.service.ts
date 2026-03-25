import { cookies } from "next/headers";
import type { SidebarCookie } from "./sidebar-cookie.service.types";

const NAME = "sidebar-collapsed";

export const sidebarCookie = {
  async get(): Promise<SidebarCookie> {
    const cookie = (await cookies()).get(NAME);
    const isCollapsed = cookie?.value === "true";

    return { isCollapsed };
  },
  async set(value: SidebarCookie) {
    (await cookies()).set(NAME, String(value.isCollapsed));
  },
};
