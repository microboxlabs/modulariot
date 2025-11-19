"use client";

import { Dropdown, DropdownItem } from "flowbite-react";
import { OtherOptionsProps } from "./other-options.types";
import React, { useState, useEffect } from "react";
import { TaskOutcome } from "../../services/form.service.types";
import { ReusableDropdownButton } from "./reusable-dropdown-button";

interface CanceledAnnulledAndOptionsProps extends OtherOptionsProps {
  otherOptions: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
  }>;
}

/* Canceled and Annulled and adding options */

export default function CanceledAnnulledAndOptions({
  dict,
  handleSelection,
  otherOptions,
}: CanceledAnnulledAndOptionsProps) {
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
