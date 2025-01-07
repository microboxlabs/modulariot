"use client";
import React, { useEffect, useState } from "react";
import { Flowbite } from "flowbite-react";
import { check_theme_cookie, set_theme_cookie } from "./CookieThemeChecking";

export default function ClientThemeDetector({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const isDeviceDarkMode = () => {
    const isDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    return isDarkMode;
  };

  const updateThemeFromDevice = async () => {
    const device_theme = isDeviceDarkMode() ? "dark" : "light";
    set_theme_cookie(device_theme);
    await applyOrCreateSavedTheme();
  };

  const applyOrCreateSavedTheme = async () => {
    const savedTheme = await check_theme_cookie();

    if (savedTheme) {
      document.documentElement.classList.toggle(
        "dark",
        savedTheme.value === "dark",
      );
    } else {
      updateThemeFromDevice();
    }
  };

  /* 
  
*/
  useEffect(() => {
    const init = async () => {
      // If there is a theme in the cookies we load it, if not we create a new one based on the device
      applyOrCreateSavedTheme();

      // change the theme if the user changes the theme of the device (on runtime)
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", () => {
        const device_theme = isDeviceDarkMode() ? "dark" : "light";
        set_theme_cookie(device_theme);
        setTheme(device_theme);
        document.documentElement.classList.toggle(
          "dark",
          device_theme === "dark",
        );
      });

      // Clean up the listener when the component unmounts
      return () =>
        mediaQuery.removeEventListener("change", updateThemeFromDevice);
    };

    init();
  }, [theme]);

  return <Flowbite theme={{ mode: theme }}>{children}</Flowbite>;
}
