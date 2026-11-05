import type { ReactNode } from "react";
import { Card, CardHeader, Tile } from "./card";
import NumberedSection from "./section";

/** A text or number input in the level response, with its error state. */
export const FIELD =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-white";
export const FIELD_ERROR =
  "!border-red-500 focus:!ring-red-500 dark:!border-red-500";

/**
 * One part of a level's response: notices, operator, closing. With a number it
 * is the rule sheet's numbered section, the same one the Regla tab uses;
 * without one it is a plain card.
 */
export function ResponseBlock({
  title,
  number,
  subtitle,
  icon,
  aside,
  children,
}: Readonly<{
  title: string;
  /** The block's place in the level's response, shown as the section badge. */
  number?: number;
  subtitle?: string;
  /** The header's tile, like a catalog card's; only without a number. */
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}>) {
  if (number !== undefined) {
    return (
      <NumberedSection
        number={number}
        title={title}
        subtitle={subtitle}
        actions={aside}
      >
        {children}
      </NumberedSection>
    );
  }
  return (
    <Card>
      <section aria-label={title} className="flex min-w-0 flex-col">
        <CardHeader tile={icon && <Tile>{icon}</Tile>} title={title}>
          {aside}
        </CardHeader>
        <div className="flex min-w-0 flex-col gap-4 px-4 py-4">{children}</div>
      </section>
    </Card>
  );
}

/** A label in a fixed column and its controls beside it. */
export function FieldRow({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="grid items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex flex-wrap items-center gap-2 text-gray-700 dark:text-gray-300">
        {children}
      </div>
    </div>
  );
}

/** An error under the control that caused it. */
export function FieldError({ text }: Readonly<{ text: string | undefined }>) {
  if (!text) return null;
  return <p className="text-xs text-red-600 dark:text-red-400">{text}</p>;
}
