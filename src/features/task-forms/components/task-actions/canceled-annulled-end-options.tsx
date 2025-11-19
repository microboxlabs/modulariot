"use client";

import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiOutlineArrowLeft,
  HiTrash,
  HiOutlineArrowRight,
} from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  OUTCOME_CONFIRM_MONITORING_FINALIZATION,
  OUTCOME_TRIP_CANCELED,
  OUTCOME_TRIP_ANNULLED,
} from "../../services/form.service";
import { OtherOptionsProps } from "./other-options.types";
import React, { useState, useEffect } from "react";
import { ReusableDropdownButton } from "./reusable-dropdown-button";

export default function CanceledAnnulledEndOptions({
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
    {
      id: OUTCOME_TRIP_CANCELED,
      label: (dict.outcome as I18nRecord).canceled as string,
      icon: HiOutlineArrowLeft,
    },
    {
      id: OUTCOME_TRIP_ANNULLED,
      label: (dict.outcome as I18nRecord).annulled as string,
      icon: HiTrash,
    },
    {
      id: OUTCOME_CONFIRM_MONITORING_FINALIZATION,
      label: (dict.outcome as I18nRecord)
        .confirmMonitoringFinalization as string,
      icon: HiOutlineArrowRight,
    },
  ];

  const blurred = "opacity-100 visible z-10 backdrop-blur-[10px] bg-black/30";
  const clean = "opacity-0 invisible backdrop-blur-[0px] bg-transparent";

  return (
    <div className="" onClick={() => setIsOpen(!isOpen)}>
      <div
        className={`fixed inset-0 z-10 transition-all duration-300 ${isOpen ? blurred : clean}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(false);
        }}
      />
      <Dropdown
        placement="bottom-start"
        label={false}
        renderTrigger={() => (
          <ReusableDropdownButton isOpen={isOpen} dict={dict} />
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
