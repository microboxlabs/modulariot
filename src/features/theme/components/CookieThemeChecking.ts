"use server";
import { cookies } from "next/headers";

export async function check_theme_cookie() {
  const theme = cookies().get("theme");
  return theme;
}

export async function set_theme_cookie(theme: "light" | "dark") {
  cookies().set("theme", theme);
}
