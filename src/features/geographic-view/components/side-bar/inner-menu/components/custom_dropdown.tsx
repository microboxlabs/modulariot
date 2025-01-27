import { DropdownItem, Button, Dropdown } from "flowbite-react";

import { useState } from "react";
import { HiTruck, HiChevronDown } from "react-icons/hi";

export default function CustomDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="" onClick={() => setIsOpen(!isOpen)}>
      <div
        className="fixed inset-0  z-10 transition-all duration-300"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(false);
        }}
      />
      <Dropdown
        placement="bottom-start"
        label={false}
        renderTrigger={() => (
          <Button
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 gap-2 w-full "
          >
            <div className="flex space-between w-full">
              <div className="flex items-center gap-2 justify-self-start w-full">
                <HiTruck className="text-gray-900 dark:text-gray-100 w-5 h-5 transition-transform ease-in-out duration-300" />
                <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
                  Flota total
                </p>
              </div>
              <HiChevronDown
                className={`text-gray-900 dark:text-gray-100 w-5 h-5 transition-transform ease-in-out duration-300 ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </Button>
        )}
        theme={{
          content: "z-20 w-full",
          floating: {
            base: "overflow-hidden rounded-lg z-20",
            item: {
              container: "w-full",
            },
          },
        }}
      >
        <DropdownItem className="flex gap-1 w-full">example</DropdownItem>
      </Dropdown>
    </div>
  );
}
