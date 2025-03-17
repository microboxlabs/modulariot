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
          // Get current theme
          const isDark = document.documentElement.classList.contains("dark");
          const newTheme = isDark ? "light" : "dark";

          // Toggle the class manually
          document.documentElement.classList.toggle("dark");

          // Set the cookie
          await set_theme_cookie(newTheme);
        }}
      />
    </div>
  );
}
