"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { DropdownItem, Dropdown, Button } from "flowbite-react";
import React, { useState } from "react";
import { HiChevronUp } from "react-icons/hi";

type Option = {
  id: number;
  label: string;
  icon: React.ElementType;
  function: () => void;
};

export default function BlurrableDropdown({
  dict,
  options,
}: {
  dict: I18nRecord;
  options: Option[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const blurred = "opacity-100 visible z-10 backdrop-blur-[10px] bg-black/30";
  const clean = "opacity-0 invisible backdrop-blur-[0px] bg-transparent";

  return (
    <div className="z-50" onClick={() => setIsOpen(!isOpen)}>
      <div
        className={`fixed inset-0 flex justify-center items-center transition-all duration-300 ${isOpen ? blurred : clean}`}
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
            className="h-10 transition-all duration-100 !z-20 bg-white dark:bg-gray-800 rounded-r-none gap-2 w-fit"
          >
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
                {(dict as I18nRecord).other_options as string}
              </p>
              <HiChevronUp
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
        {options.map(({ id, label, icon: Icon, function: Function }) => (
          <DropdownItem
            key={id}
            className="flex gap-1 w-full"
            onClick={() => {
              Function();
              setIsOpen(!isOpen);
            }}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
  );
}
