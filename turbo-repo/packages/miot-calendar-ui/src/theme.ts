import { createTheme } from "flowbite-react";

/**
 * flowbite-react theme customizations the calendar UI relies on.
 *
 * The package renders flowbite `Button`s (and `ButtonGroup`/`Label`/`Spinner`)
 * that expect the host's brand accent on the default button color. Mirrors the
 * relevant bits of the host's own modular theme so an external consumer gets the
 * same look by wrapping the calendar in
 * `<ThemeProvider theme={miotCalendarTheme}>`.
 *
 * Kept intentionally minimal — only the primary-button accent, which is the one
 * flowbite default the calendar overrides. The `primary-*` palette itself comes
 * from `@import "flowbite-react/plugin/tailwindcss"` (flowbite's default), so a
 * consumer needs only that plugin + this theme. Override `primary` in your
 * Tailwind config to rebrand without touching this theme.
 */
export const miotCalendarTheme = createTheme({
  button: {
    color: {
      default:
        "bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800",
    },
  },
});
