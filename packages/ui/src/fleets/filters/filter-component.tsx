import React, { useState } from "react";
import Image from "next/image";
import { FaRegTrashAlt } from "react-icons/fa";
import LabelledButton from "../../buttons/labelled-button";
import CustomTooltip from "../../custom-tooltip";
import { type Option } from "./types/options.type";


export default function FilterComponent({
  icon, 
  label,
  onChange,
  children,
  filters,
  setFilters
}: {
  icon: React.ReactElement;
  label: string;
  onChange?: (updatedOptions: Option[]) => void;
  children?: React.ReactNode;
  filters: Option[];
  setFilters: (filters: Option[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activatedCount = filters.filter(
    (option) => option.activated
  ).length;

  return (
    <div className="relative h-full flex flex-row gap-2 z-0">
      <div
        className={`relative h-10 transition-all duration-300`}
      >
        <LabelledButton
          label={label}
          onClick={() => setExpanded(!expanded)}
          hover_disabled={expanded}
          disable_label_after_click={true}
        >
          {icon}
        </LabelledButton>
        <div className="absolute h-10 w-10 top-0 left-0 pointer-events-none">
          <div
            className={`flex flex-row items-center justify-center gap-2 absolute transition-all duration-300 right-[-6px] top-[-6px] border-2 border-white z-20 bg-amber-300 rounded-full w-5 h-5 ${
              activatedCount > 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-gray-900 text-xs w-5 h-5 text-center mt-1">
              {activatedCount}
            </p>
          </div>
        </div>
      </div>
      <div
        className={`px-1 h-10 transition-all duration-300 ease-in-out !flex justify-center items-center flex-row gap-2 w-fit overflow-hidden ${expanded ? "opacity-100" : "opacity-0 animate-hide"}`}
      >
        {children}
        <div
          onClick={() => { 
            filters.forEach((filter) => filter.activated = false);
            setFilters([...filters]);
            setExpanded(false);
            onChange?.([...filters]);
          }}
          className={`w-7 h-7 bg-red-500 rounded-full p-1 flex items-center justify-center hover:cursor-pointer hover:border-2 hover:border-gray-300 text-white ${expanded ? "" : "pointer-events-none"}`}
        >
          <FaRegTrashAlt />
        </div>
      </div>
    </div>
  );
}
