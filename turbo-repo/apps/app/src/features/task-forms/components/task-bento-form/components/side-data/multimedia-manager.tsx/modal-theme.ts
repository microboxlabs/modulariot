import type { CustomFlowbiteTheme } from "flowbite-react";

/** Standard modal theme used across multimedia manager modals. */
export const MODAL_THEME: CustomFlowbiteTheme["modal"] = {
  content: {
    base: "relative w-full p-4 md:h-auto",
    inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
  },
  header: {
    base: "flex items-center justify-between rounded-t border-b p-4 pb-0 dark:border-gray-600",
    title: "text-base font-semibold text-gray-900 dark:text-white",
    close: { base: "hidden" },
  },
  body: {
    base: "flex-1 overflow-auto pt-4 px-4 pb-4",
  },
};

/** Larger-padded modal theme variant (e.g. move-to-task modal). */
export const MODAL_THEME_LG: CustomFlowbiteTheme["modal"] = {
  content: {
    base: "relative w-full p-4 md:h-auto",
    inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
  },
  header: {
    base: "flex items-center justify-between rounded-t border-b pt-5 px-5 pb-0 dark:border-gray-600",
    title: "text-base font-semibold text-gray-900 dark:text-white",
    close: { base: "hidden" },
  },
  body: {
    base: "flex-1 overflow-auto px-5 pb-5",
  },
};
