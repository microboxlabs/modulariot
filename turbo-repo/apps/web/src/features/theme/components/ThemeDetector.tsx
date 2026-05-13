"use client";
import React, { useEffect, useState } from "react";
import { Spinner, ThemeProvider } from "flowbite-react";
import { check_theme_cookie, set_theme_cookie } from "./CookieThemeChecking";
import { flowbiteTheme } from "../flowbite-theme";

type Theme = "light" | "dark";

export default function ThemeDetector({
  children,
}: {
  children: React.ReactNode;
}) {
  const [, setTheme] = useState<Theme>("light");
  const [isLoading, setIsLoading] = useState(true);

  const isDeviceDarkMode = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    set_theme_cookie(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const updateThemeFromDevice = async () => {
    setIsLoading(true);
    const deviceTheme: Theme = isDeviceDarkMode() ? "dark" : "light";
    set_theme_cookie(deviceTheme);
    applyTheme(deviceTheme);
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
    const init = async () => {
      try {
        await applyOrCreateSavedTheme();
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", updateThemeFromDevice);
      return () =>
        mediaQuery.removeEventListener("change", updateThemeFromDevice);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  return <ThemeProvider theme={flowbiteTheme}>{children}</ThemeProvider>;
}
