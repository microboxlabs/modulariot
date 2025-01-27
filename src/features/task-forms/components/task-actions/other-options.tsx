"use client";

import { Button, Dropdown, DropdownItem } from "flowbite-react";
import {
  HiCheck,
  HiOutlineHand,
  HiOutlineArrowLeft,
  HiTrash,
  HiChevronUp,
} from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  OUTCOME_INITIATION_WITH_OBJECTIONS,
  OUTCOME_OVERLORD_REQUIRED,
  OUTCOME_CANCELED,
  OUTCOME_ANNULLED,
  OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
} from "../../services/form.service";
import { OtherOptionsProps } from "./other-options.types";
import React, { useState, useEffect } from "react";

export default function OtherOptions({
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

  const other_options = [
    // This was commented since its something that might change in the future
    /*
    {
      id: OUTCOME_NORMAL_INITIATION,
      label: (dict.outcome as I18nRecord).normalInitiation as string,
      icon: HiCheck,
    },
    */
    {
      id: OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
      label: (dict.outcome as I18nRecord)
        .initiatedWithoutSovosSignature as string,
      icon: HiCheck,
    },
    {
      id: OUTCOME_INITIATION_WITH_OBJECTIONS,
      label: (dict.outcome as I18nRecord).initiationWithObjections as string,
      icon: HiCheck,
    },
    {
      id: OUTCOME_OVERLORD_REQUIRED,
      label: (dict.outcome as I18nRecord).requiresOverlord as string,
      icon: HiOutlineHand,
    },
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
        {other_options.map(({ id, label, icon: Icon }) => (
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
