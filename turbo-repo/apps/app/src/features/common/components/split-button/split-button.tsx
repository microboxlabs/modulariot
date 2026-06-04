"use client";

import { Button, Dropdown, DropdownItem, Tooltip } from "flowbite-react";
import { HiChevronDown } from "react-icons/hi2";
import type { ReactNode } from "react";

function MaybeTooltip({ content, children }: Readonly<{ content: ReactNode; children: ReactNode }>) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip content={content} placement="bottom">
      <div>{children}</div>
    </Tooltip>
  );
}

export type SplitButtonAction = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
};

export type SplitButtonProps = Readonly<{
  primary: SplitButtonAction;
  secondaryActions: SplitButtonAction[];
  secondaryLabel?: ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  primaryDisabled?: boolean;
  tooltip?: ReactNode;
  primaryTooltip?: ReactNode;
}>;

export default function SplitButton({
  primary,
  secondaryActions,
  secondaryLabel,
  size = "sm",
  disabled = false,
  primaryDisabled = false,
  tooltip,
  primaryTooltip,
}: SplitButtonProps) {
  const btnSize = size === "sm" ? "sm" : "md";

  return (
    <div className="flex items-stretch">
      {/* Secondary: single Button OR Flowbite Dropdown */}
      {secondaryActions.length === 1 && !secondaryLabel && (
        <MaybeTooltip content={disabled ? tooltip : undefined}>
          <Button
            color="light"
            size={btnSize}
            disabled={disabled}
            onClick={secondaryActions[0].onClick}
            className="rounded-r-none border-r-0 focus:ring-0 gap-1"
          >
            {secondaryActions[0].icon}
            {secondaryActions[0].label}
          </Button>
        </MaybeTooltip>
      )}

      {secondaryActions.length > 0 &&
        (secondaryActions.length > 1 || secondaryLabel) && (
        <MaybeTooltip content={disabled ? tooltip : undefined}>
          <Dropdown
            label=""
            disabled={disabled}
            renderTrigger={() => (
              <Button
                color="light"
                size={btnSize}
                disabled={disabled}
                className="rounded-r-none border-r-0 focus:ring-0"
              >
                {secondaryLabel && (
                  <span className="hidden lg:block whitespace-nowrap">
                    {secondaryLabel}
                  </span>
                )}
                <HiChevronDown className="w-4 h-4" />
              </Button>
            )}
            theme={{
              floating: {
                base: "overflow-hidden rounded-lg z-50",
                style: {
                  auto: "w-max border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg",
                },
              },
            }}
          >
            {secondaryActions.map((action) => (
              <DropdownItem
                key={action.id}
                onClick={action.onClick}
                className="whitespace-nowrap cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {action.icon}
                  {action.label}
                </span>
              </DropdownItem>
            ))}
          </Dropdown>
        </MaybeTooltip>
      )}

      {/* Primary Button */}
      <MaybeTooltip content={(disabled || primaryDisabled) ? primaryTooltip : undefined}>
        <Button
          color="blue"
          size={btnSize}
          disabled={disabled || primaryDisabled}
          onClick={primary.onClick}
          className={"gap-1 " + (secondaryActions.length > 0 ? "rounded-l-none focus:ring-0" : "focus:ring-0")}
        >
          {primary.icon}
          {primary.label}
        </Button>
      </MaybeTooltip>
    </div>
  );
}
