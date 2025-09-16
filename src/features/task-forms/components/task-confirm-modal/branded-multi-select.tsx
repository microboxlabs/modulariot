"use client";

import { useState } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

// Icons - we'll use simple SVG icons for now
const CheckIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const ChevronDownIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

type SelectOption = {
  value: string;
  labelKey: string;
  descriptionKey?: string;
};

interface BrandedMultiSelectProps {
  options: SelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  triggerText: string;
  dict: I18nRecord;
  placeholder?: string;
}

export default function BrandedMultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  triggerText,
  dict,
  placeholder = "Seleccionar opciones",
}: BrandedMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return triggerText || placeholder;
    }
    if (selectedValues.length === 1) {
      const selectedOption = options.find((o) => o.value === selectedValues[0]);
      return selectedOption
        ? ((dict.modal as I18nRecord)[selectedOption.labelKey] as string)
        : selectedValues[0];
    }
    return `${selectedValues.length} ${((dict.modal as I18nRecord).multipleReasonsSelected as string) || "opciones seleccionadas"}`;
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        className="w-full bg-white border border-gray-300 rounded-md px-4 py-3 text-left flex justify-between items-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center flex-1">
          {selectedValues.length > 0 && (
            <CheckIcon className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
          )}
          <span
            className={`text-sm font-medium ${
              selectedValues.length === 0 ? "text-gray-500" : "text-gray-900"
            } truncate`}
          >
            {getDisplayText()}
          </span>
        </div>
        <ChevronDownIcon
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none">
          {options.map((option) => (
            <div
              key={option.value}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
              onClick={() => handleToggleOption(option.value)}
              role="option"
              aria-selected={selectedValues.includes(option.value)}
            >
              <div className="flex items-start">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => {}} // Handled by parent div click
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pointer-events-none"
                  tabIndex={-1}
                />
                {/* Content */}
                <div className="ml-3 flex-1">
                  {/* Title */}
                  <p className="text-sm font-medium text-gray-900">
                    {(dict.modal as I18nRecord)[option.labelKey] as string}
                  </p>

                  {/* Supporting description */}
                  {option.descriptionKey && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {
                        (dict.modal as I18nRecord)[
                          option.descriptionKey
                        ] as string
                      }
                    </p>
                  )}
                </div>

                {/* Selected indicator */}
                {selectedValues.includes(option.value) && (
                  <CheckIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {options.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No hay opciones disponibles
            </div>
          )}
        </div>
      )}
    </div>
  );
}
