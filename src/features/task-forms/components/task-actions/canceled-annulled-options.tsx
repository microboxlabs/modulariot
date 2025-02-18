"use client";

import { Button, Dropdown, DropdownItem } from "flowbite-react";
import { HiOutlineArrowLeft, HiTrash, HiChevronUp } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  OUTCOME_CANCELED,
  OUTCOME_ANNULLED,
} from "../../services/form.service";
import { OtherOptionsProps } from "./other-options.types";
import React, { useState, useEffect } from "react";

export default function CanceledAnnulledOptions({
  dict,
  handleSelection,
}: OtherOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    // Cleanup listener when component unmounts
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const otherOptions = [
    {
      id: OUTCOME_CANCELED,
      label: (dict.outcome as I18nRecord).canceled as string,
      icon: HiOutlineArrowLeft,
    },
    {
      id: OUTCOME_ANNULLED,
      label: (dict.outcome as I18nRecord).annulled as string,
      icon: HiTrash,
    },
  ];

  const blurred = "opacity-100 visible z-10 backdrop-blur-[10px] bg-black/30";
  const clean = "opacity-0 invisible backdrop-blur-[0px] bg-transparent";

  return (
    <div className="" onClick={() => setIsOpen(!isOpen)}>
      <div
        className={`fixed inset-0  z-10 transition-all duration-300 ${isOpen ? blurred : clean}`}
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
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 rounded-r-none gap-2 w-fit"
          >
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
                {(dict.outcome as I18nRecord).moreOptions as string}
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
        {otherOptions.map(({ id, label, icon: Icon }) => (
          <DropdownItem
            key={id}
            className="flex gap-1 w-full"
            onClick={() => handleSelection(id, label)}
          >
            <Icon />
            {label}
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
  );
}
