"use client";

/**
 * Header mark for this page's form modals.
 *
 * Credential modals lead with the provider's logo at 40px; templates and connections
 * are operator-defined and have no artwork, so a glyph in the same footprint keeps the
 * headers aligned across both screens.
 */
export function ModalGlyph({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
      {children}
    </span>
  );
}
