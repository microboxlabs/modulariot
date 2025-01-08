"use client";

import React from "react";
import { DarkThemeToggle } from "flowbite-react";
import { set_theme_cookie } from "./CookieThemeChecking";

// The reason for this custom component is so i can set a cookie when the user clicks the toggle,
// the on click is not called if its directly in the flowbite component
export default function CustomThemeToggle() {
  return (
    <div>
      <DarkThemeToggle
        onClick={async () => {
          const theme = document.documentElement.classList.contains("dark")
            ? "light"
            : "dark";

          await set_theme_cookie(theme);
        }}
      />
    </div>
  );
}
