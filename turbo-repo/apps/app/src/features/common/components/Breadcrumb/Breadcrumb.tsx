"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Breadcrumb as FlowbiteBreadcrumb,
  BreadcrumbItem,
} from "flowbite-react";
import { HiHome } from "react-icons/hi";
import { HiPencilSquare } from "react-icons/hi2";
import { trDynamic } from "@/features/i18n/tr.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

interface BreadcrumbProps {
  path: string[];
  lang?: string;
  rootIcon?: React.ReactNode;
  rightContent?: React.ReactNode[];
  dict: I18nRecord;
  disableLinks?: boolean;
  /** When true, clicking the last crumb turns it into an editable text field. */
  editableLast?: boolean;
  onEditLast?: (value: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  path,
  lang = "en",
  rootIcon = <HiHome className="mr-2 h-4 w-4" />,
  rightContent = [],
  dict,
  disableLinks = false,
  editableLast = false,
  onEditLast,
}) => {
  const translatedPath = path.map((item) => trDynamic(item, dict));
  const lastIndex = translatedPath.length - 1;
  const lastValue = translatedPath[lastIndex] ?? "";

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(lastValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setValue(lastValue);
  }, [lastValue, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== lastValue) {
      onEditLast?.(trimmed);
    } else {
      setValue(lastValue);
    }
    setIsEditing(false);
  }, [value, lastValue, onEditLast]);

  const cancelEdit = useCallback(() => {
    setValue(lastValue);
    setIsEditing(false);
  }, [lastValue]);

  return (
    <div className="flex justify-between items-center">
      <FlowbiteBreadcrumb aria-label="Breadcrumb">
        {translatedPath.map((item, index) =>
          index === 0 ? (
            <BreadcrumbItem
              icon={() => rootIcon}
              key={index}
            >
              {item}
            </BreadcrumbItem>
          ) : index === lastIndex && editableLast ? (
            <BreadcrumbItem key={index}>
              {isEditing ? (
                <input
                  ref={inputRef}
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    else if (e.key === "Escape") cancelEdit();
                  }}
                  className="bg-transparent border-b border-gray-400 outline-none text-sm font-medium text-gray-700 dark:text-gray-300 focus:border-blue-500 dark:focus:border-blue-500"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Rename dashboard"
                  className="group flex items-center gap-1.5 cursor-text hover:underline decoration-dashed underline-offset-2"
                >
                  {item}
                  <HiPencilSquare className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300" />
                </button>
              )}
            </BreadcrumbItem>
          ) : (
            <BreadcrumbItem
              key={index}
              href={disableLinks ? undefined : `/app/${lang}/${path.slice(1, index + 1).join("/")}`}
            >
              {item}
            </BreadcrumbItem>
          )
        )}
      </FlowbiteBreadcrumb>
      {rightContent.length > 0 && (
        <div className="flex items-center space-x-2">
          {rightContent.map((content, index) => (
            <React.Fragment key={index}>{content}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
