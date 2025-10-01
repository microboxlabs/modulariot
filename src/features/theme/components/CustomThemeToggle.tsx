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
        className="h-10 w-10 select-none cursor-pointer relative flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 ring-0 hover:border-gray-300 dark:hover:border-gray-600 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600"
        onClick={async () => {
          // Get current theme
          const isDark = document.documentElement.classList.contains("dark");
          const newTheme = isDark ? "light" : "dark";

          // Toggle the class manually
          document.documentElement.classList.toggle("dark");

          // Set the cookie
          await set_theme_cookie(newTheme);
        }}
        theme={{
          root: {
            base: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 ring-0 active:border-0",
          },
        }}
      />
    </div>
  );
}
