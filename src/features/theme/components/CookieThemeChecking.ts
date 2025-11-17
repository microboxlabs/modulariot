"use server";
import { cookies } from "next/headers";

export async function check_theme_cookie() {
  try {
    const theme = (await cookies()).get("theme");
    return theme;
  } catch (error) {
    return null;
  }
}

export async function set_theme_cookie(theme: "light" | "dark") {
  (await cookies()).set("theme", theme);
}
