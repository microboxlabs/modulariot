"use client";

import React from "react";
import { DarkThemeToggle } from "flowbite-react";
import { set_theme_cookie } from "./CookieThemeChecking";

export default function CustomThemeToggle() {
  return (
    <div
      onClick={async () => {
        const theme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        await set_theme_cookie(theme);
      }}
    >
      <DarkThemeToggle />
    </div>
  );
}
