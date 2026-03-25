import { createTheme } from "flowbite-react";

export const flowbiteTheme = createTheme({
  button: {
    base: "relative flex items-center justify-center rounded-lg text-center font-medium focus:outline-none focus:ring-4 cursor-pointer",
  },
  sidebar: {
    root: {
      inner:
        "h-full overflow-y-auto border-r overflow-x-hidden px-3 py-4 border-gray-200 dark:border-gray-900 dark:bg-gray-800 ",
    },
  },
});
