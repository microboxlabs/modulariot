"use client";

import { Button, Dropdown, DropdownItem } from "flowbite-react";
import { HiChevronUp, HiArrowRight } from "react-icons/hi";
import React, { useState, useEffect } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { BsStars } from "react-icons/bs";
import { GiPoliceBadge } from "react-icons/gi";
import { MdCancel } from "react-icons/md";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
export default function BlurrableDropdown({
  isMenuOpen,
  setIsMenuOpen,
  dict,
}: {
  isMenuOpen: boolean;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  dict: I18nRecord;
}) {
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
      id: 0,
      label: (dict.symptoms as I18nRecord).derive_to_specialist as string,
      icon: HiArrowRight,
    },
    {
      id: 1,
      label: (dict.symptoms as I18nRecord).contact_carabineros as string,
      icon: GiPoliceBadge,
    },
    {
      id: 2,
      label: (dict.symptoms as I18nRecord).contact_via_whatsapp as string,
      icon: FaWhatsapp,
    },
    {
      id: 3,
      label: (dict.symptoms as I18nRecord).copilot as string,
      icon: BsStars,
    },
    {
      id: 4,
      label: (dict.symptoms as I18nRecord).ignore_condition as string,
      icon: MdCancel,
    },
  ];

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
                {(dict.symptoms as I18nRecord).other_options as string}
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
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
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
