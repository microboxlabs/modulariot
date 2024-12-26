"use client";

import React, { useEffect, useState } from "react";
import { Flowbite } from "flowbite-react";

export default function ThemeDetector({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Function to update the theme based on system preference
    const updateTheme = () => {
      const isDarkMode = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setTheme(isDarkMode ? "dark" : "light");
    };

    // Set initial theme
    updateTheme();

    // Add listener for changes in color scheme preference
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateTheme);

    // Clean up the listener when the component unmounts
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    // Apply the theme class to the body element
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <Flowbite theme={{ mode: theme }}>{children}</Flowbite>;
}
