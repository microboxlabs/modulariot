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
  OUTCOME_NORMAL_INITIATION,
  OUTCOME_INITIATION_WITH_OBJECTIONS,
  OUTCOME_OVERLORD_REQUIRED,
  OUTCOME_CANCELED,
  OUTCOME_ANNULLED,
} from "../../services/form.service";
import { OtherOptionsProps } from "./other-options.types";
import React, { useState } from "react";

export default function OtherOptions({
  dict,
  handleSelection,
}: OtherOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const other_options = [
    {
      id: OUTCOME_NORMAL_INITIATION,
      label: (dict.outcome as I18nRecord).normalInitiation as string,
      icon: HiCheck,
    },
    // This was commented since its something that might change in the future
    /*
    {
      id: OUTCOME_INITIATED_WITHOUT_SOVOS_SIGNATURE,
      label: (dict.outcome as I18nRecord)
        .initiatedWithoutSovosSignature as string,
      icon: HiCheck,
    },
    */
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
    <div className="w-full lg:w-1/2" onClick={() => setIsOpen(!isOpen)}>
      <div
        className={`fixed inset-0  z-10 transition-all duration-300 ${isOpen ? blurred : clean}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(false);
        }}
      />
      <Dropdown
        label={false}
        renderTrigger={() => (
          <Button
            color="gray"
            className="h-10 w-full transition-all duration-100 z-50 bg-white dark:bg-gray-800"
          >
            <HiChevronUp
              className={`text-gray-900 dark:text-gray-100 mr-2 w-5 h-5 transition-transform ease-in-out duration-300 ${isOpen ? "rotate-180" : ""}`}
            />
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {(dict.outcome as I18nRecord).moreOptions as string}
            </p>
          </Button>
        )}
        theme={{
          content: "z-50",
          floating: {
            base: "overflow-hidden rounded-lg z-50 py-1",
            item: {
              container: "w-full z-50",
            },
          },
        }}
      >
        {other_options.map(({ id, label, icon: Icon }) => (
          <DropdownItem
            key={id}
            className="flex gap-1 w-full z-50"
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
