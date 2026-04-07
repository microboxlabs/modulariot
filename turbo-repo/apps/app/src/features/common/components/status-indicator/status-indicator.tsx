import type { IconType } from "react-icons";

export interface StatusOption<T extends string> {
  /** The value that identifies this status */
  readonly value: T;
  /** Display label */
  readonly label: string;
  /** Tailwind color class (e.g. "text-green-500") */
  readonly colorClass: string;
  /** Icon component to render */
  readonly icon: IconType;
}

interface StatusIndicatorProps<T extends string> {
  /** Current active value */
  readonly value: T;
  /** Array of possible status options */
  readonly options: ReadonlyArray<StatusOption<T>>;
  /** Whether to hide the label and show only the icon */
  readonly iconOnly?: boolean;
}

export default function StatusIndicator<T extends string>({
  value,
  options,
  iconOnly = false,
}: Readonly<StatusIndicatorProps<T>>) {
  const match = options.find((opt) => opt.value === value);

  if (!match) return null;

  const Icon = match.icon;

  return (
    <span className={`flex items-center gap-1 ${match.colorClass}`}>
      {!iconOnly && match.label} <Icon className="w-4 h-4" />
    </span>
  );
}
