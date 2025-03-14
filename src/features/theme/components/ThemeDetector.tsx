"use client";
import React, { useEffect, useState } from "react";
import { Spinner } from "flowbite-react";
import { check_theme_cookie, set_theme_cookie } from "./CookieThemeChecking";

type Theme = "light" | "dark";

export default function ClientThemeDetector({
  children,
}: {
  children: React.ReactNode;
}) {
  const [_, setTheme] = useState<"light" | "dark">("light");
  const [isLoading, setIsLoading] = useState(true);

  const isDeviceDarkMode = () => {
    const isDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    return isDarkMode;
  };

  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    set_theme_cookie(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const updateThemeFromDevice = async () => {
    setIsLoading(true);
    const device_theme = isDeviceDarkMode() ? "dark" : "light";
    set_theme_cookie(device_theme);
    applyTheme(device_theme);
    setIsLoading(false);
  };

  const applyOrCreateSavedTheme = async () => {
    const savedTheme = await check_theme_cookie();

    if (savedTheme) {
      applyTheme(savedTheme.value as Theme);
    } else {
      updateThemeFromDevice();
    }
  };

  useEffect(() => {
    console.log("something");

    const init = async () => {
      try {
        await applyOrCreateSavedTheme();
      } catch (error) {
        console.error("ups: ", error);
      } finally {
        setIsLoading(false);
      }

      // change the theme if the user changes the theme of the device (on runtime)
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", updateThemeFromDevice);

      // Clean up the listener when the component unmounts
      return () =>
        mediaQuery.removeEventListener("change", updateThemeFromDevice);
    };

    init();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
