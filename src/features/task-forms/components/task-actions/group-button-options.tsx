"use client";

import { Button, Dropdown, DropdownItem } from "flowbite-react";
import { OtherOptionsProps } from "./other-options.types";
import React, { useState, useEffect } from "react";
import { TaskOutcome } from "../../services/form.service.types";
import { TaskActionDropdownButton } from "./task-action-dropdown-button";
import { twMerge } from "tailwind-merge";
import { tr } from "@/features/i18n/tr.service";
import { HiChevronUp } from "react-icons/hi";
import TaskActionButton from "../task-action-button/task-action-button";

interface GroupButtonOptionsProps extends OtherOptionsProps {
  otherOptions: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
  }>;
}

/* Canceled and Annulled and adding options */

export default function GroupButtonOptions({
  dict,
  handleSelection,
  otherOptions,
}: GroupButtonOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const blurred = "opacity-100 visible z-10 backdrop-blur-[10px] bg-black/30";
  const clean = "opacity-0 invisible backdrop-blur-[0px] bg-transparent";

  return (
    <div onClick={() => setIsOpen(!isOpen)}>
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
        theme={{
          content: "z-20 w-full",
          floating: {
            base: "overflow-hidden rounded-lg z-20",
            item: {
              container: "w-full",
            },
          },
        }}
        renderTrigger={() => (
          <Button
            color="alternative"
            theme={{
              base: twMerge(
                "relative",
                "flex items-center justify-center",
                "!rounded-lg !rounded-r-none !border-l-1",
                "text-center font-medium",
                "focus:outline-none focus:ring-4",
                "cursor-pointer",
                "h-10 transition-all duration-100 z-20",
                "gap-2 w-fit"
              ),
            }}
          >
            <div className="flex items-center gap-2">
              <span className="lg:block hidden whitespace-nowrap">
                {tr("outcome.moreOptions", dict)}
              </span>
              <HiChevronUp
                className={`w-5 h-5 transition-transform ease-in-out duration-300 ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </Button>
        )}
      >
        {otherOptions.map(({ id, label, icon: Icon }) => (
          <DropdownItem
            key={id}
            className="flex gap-1 w-full"
            onClick={() => handleSelection(id as TaskOutcome, label)}
          >
            <Icon />
            {label}
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
  );
}
