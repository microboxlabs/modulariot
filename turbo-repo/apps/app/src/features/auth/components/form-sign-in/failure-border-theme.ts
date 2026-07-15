import type { TextInputProps } from "flowbite-react";

// flowbite-react's "failure" color bundles border, background, text and
// placeholder classes together (border-red-500 bg-red-50 text-red-900
// placeholder-red-700 ...). We want an invalid field to look IDENTICAL to
// a normal ("gray") input — same background, text, placeholder, focus
// ring — just with a red border instead of gray. So this is the "gray"
// color string verbatim, with only its border classes swapped to red.
// Theme merging is additive (it only adds classes, never removes them),
// so overriding `theme` alone would leave the base bg-red-50/text-red-900
// classes in place too; `clearTheme` wipes that leaf to "" first so this
// full replacement is all that's left.
const failureBorderColors = {
  failure:
    "border-red-500 bg-gray-50 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500 dark:border-red-400 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500",
};

export const failureBorderTheme: TextInputProps["theme"] = {
  field: { input: { colors: failureBorderColors } },
};

export const failureBorderClearTheme: TextInputProps["clearTheme"] = {
  field: { input: { colors: { failure: true } } },
};

/** For call sites that need to merge in an additional `theme.field.input.base` override alongside the failure-border colors (e.g. reserving space for an icon). */
export function withFailureBorderTheme(
  inputBase: string
): TextInputProps["theme"] {
  return { field: { input: { base: inputBase, colors: failureBorderColors } } };
}
