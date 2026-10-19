import { Button, ButtonGroup } from "flowbite-react";

export interface SegmentedSwitcherOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedSwitcherProps<T extends string> {
  options: SegmentedSwitcherOption<T>[];
  active: T;
  onChange: (value: T) => void;
  size?: "xs" | "sm" | "md";
  /** Accessible name for the group. */
  label?: string;
}

/**
 * A row of joined buttons where exactly one is on — the shipping board's
 * Kanban / Table switcher, for any set of values. The active button is
 * disabled, so it reads as selected and cannot be pressed again.
 */
export function SegmentedSwitcher<T extends string>({
  options,
  active,
  onChange,
  size = "md",
  label,
}: Readonly<SegmentedSwitcherProps<T>>) {
  return (
    <ButtonGroup aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          color="alternative"
          size={size}
          onClick={() => onChange(option.value)}
          disabled={active === option.value}
          aria-pressed={active === option.value}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
