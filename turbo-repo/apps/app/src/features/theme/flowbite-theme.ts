import { createTheme } from "flowbite-react";

export const flowbiteTheme = createTheme({
  button: {
    base: "relative flex items-center justify-center rounded-lg text-center font-medium focus:outline-none focus:ring-4 cursor-pointer",
  },
  // Flowbite's size classes set `p-*`, which overrides the base `pr-10` and puts the
  // arrow (12px from the right) over the text. Each size keeps room for it.
  select: {
    field: {
      select: {
        sizes: {
          sm: "py-2 pl-2 pr-8 sm:text-xs",
          md: "py-2.5 pl-2.5 pr-10 text-sm",
          lg: "py-4 pl-4 pr-12 sm:text-base",
        },
      },
    },
  },
  sidebar: {
    root: {
      inner:
        "h-full overflow-y-auto border-r overflow-x-hidden px-3 py-4 border-gray-200 dark:border-gray-900 dark:bg-gray-800 ",
    },
  },
});
