import { Dropdown, DropdownItem } from "flowbite-react";
import React from "react";

export default function CustomDropdown({
  options,
  renderTrigger,
}: {
  options: {
    id: number;
    label: string;
    icon: React.ReactElement;
    function: () => void;
    disabledOption?: boolean;
  }[];
  renderTrigger: React.ReactElement;
}) {
  return (
    <Dropdown
      placement="bottom-start"
      label={false}
      renderTrigger={() => renderTrigger}
      theme={{
        content: "z-20 w-full",
        floating: {
          base: "overflow-hidden rounded-lg z-20",
          item: {
            container: "w-full",
          },
          style: {
            auto: "border border-gray-200 bg-white text-gray-900 dark:border-gray-500 dark:bg-gray-700 dark:text-white",
          },
        },
      }}
    >
      {options.map(
        ({ label, icon, function: FunctionAction, disabledOption }, index) => (
          <DropdownItem
            key={index}
            className="flex gap-2 w-full"
            onClick={() => {
              FunctionAction();
            }}
            disabled={disabledOption}
            color={disabledOption ? "gray" : "default"}
            style={
              disabledOption ? { opacity: 0.5, cursor: "not-allowed" } : {}
            }
          >
            {icon}
            {label}
          </DropdownItem>
        )
      )}
    </Dropdown>
  );
}
