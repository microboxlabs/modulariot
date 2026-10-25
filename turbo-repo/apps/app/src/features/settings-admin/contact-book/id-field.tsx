"use client";

import { Select, TextInput } from "flowbite-react";
import { HiXCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { inputValidationColor } from "./input-validation";
import { ID_PLACEHOLDER, maskId, type IdType } from "./tax-id";

const LABEL_CLASS = "text-xs font-medium text-gray-600 dark:text-gray-300";

/** A document or tax id: its type, then the number in that type's shape. */
export default function IdField({
  label,
  types,
  type,
  value,
  invalid,
  onChange,
  d,
}: Readonly<{
  label: string;
  types: readonly IdType[];
  type: IdType;
  value: string;
  invalid: boolean;
  /** Changing the type reshapes the number already typed. */
  onChange: (type: IdType, value: string) => void;
  d: I18nRecord;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      <div className="flex gap-2">
        <Select
          aria-label={`${label} · ${tr("idTypeLabel", d)}`}
          className="w-36 shrink-0"
          value={type}
          onChange={(e) => {
            const next = e.target.value as IdType;
            onChange(next, maskId(next, value));
          }}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {trDynamic(`idType_${t}`, d)}
            </option>
          ))}
        </Select>
        <TextInput
          aria-label={label}
          className="min-w-0 flex-1"
          color={inputValidationColor(value, !invalid)}
          placeholder={ID_PLACEHOLDER[type]}
          value={value}
          onChange={(e) => onChange(type, maskId(type, e.target.value))}
        />
      </div>
      {invalid && (
        <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <HiXCircle className="h-3.5 w-3.5" />
          {tr("idInvalid", d)}
        </p>
      )}
    </div>
  );
}
