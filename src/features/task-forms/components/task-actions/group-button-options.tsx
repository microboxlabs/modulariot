"use client";

import { Dropdown, DropdownItem } from "flowbite-react";
import { OtherOptionsProps } from "./other-options.types";
import React, { useState, useEffect } from "react";
import { TaskOutcome } from "../../services/form.service.types";
import { TaskActionDropdownButton } from "./task-action-dropdown-button";

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
        renderTrigger={() => (
          <TaskActionDropdownButton isOpen={isOpen} dict={dict} />
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
