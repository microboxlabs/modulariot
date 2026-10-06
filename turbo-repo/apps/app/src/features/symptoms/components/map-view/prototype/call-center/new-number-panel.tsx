"use client";

/**
 * PROTOTYPE — "Agregar contacto" in the call-center list, inline instead of a
 * modal: phone number first, then a name, then either just call (the person
 * joins this list, so the call lands in its "Ya llamados" history) or call
 * and also save them to the contact book. The phone uses the same input as
 * the contact book's phone channel: PhoneInput (country code picker, E.164
 * value).
 */

import { useState, type SubmitEvent } from "react";
import { TextInput } from "flowbite-react";
import { HiArrowLeft, HiOutlineBookmark, HiPhone } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import PhoneInput, {
  isValidPhone,
  toE164,
} from "@/features/common/components/phone-input/phone-input";

export type NewNumberAction = "call" | "callAndSave";

export interface NewNumberDraft {
  phone: string;
  name: string;
}

/** Pre-fills the panel from a search: something that looks like a number
 *  goes into the phone field, anything else into the name. */
export function draftFromQuery(query: string): NewNumberDraft {
  const text = query.trim();
  const looksLikeNumber = /^[+\d\s().-]+$/.test(text) && /\d/.test(text);
  if (!looksLikeNumber) return { phone: "", name: text };
  return { phone: toE164(text) ?? "", name: "" };
}

/** Only calling needs a valid number; saving to the book also needs a name. */
export function canSubmitNewNumber(
  draft: NewNumberDraft,
  action: NewNumberAction
): boolean {
  if (!isValidPhone(draft.phone)) return false;
  return action === "call" || draft.name.trim() !== "";
}

export default function NewNumberPanel({
  dict,
  onSubmit,
  onCancel,
  initial = { phone: "", name: "" },
}: Readonly<{
  dict: I18nRecord;
  onSubmit: (draft: NewNumberDraft, action: NewNumberAction) => void;
  onCancel: () => void;
  /** Starting values, e.g. from what was typed in the search. */
  initial?: NewNumberDraft;
}>) {
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const [draft, setDraft] = useState<NewNumberDraft>(initial);

  const submit = (action: NewNumberAction) => {
    if (canSubmitNewNumber(draft, action)) onSubmit(draft, action);
  };

  // Enter anywhere in the panel = the plain "just call".
  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit("call");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-white p-3 dark:bg-gray-800"
    >
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 self-start text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <HiArrowLeft className="h-3.5 w-3.5" />
        {t("call_center_new_back")}
      </button>

      <PhoneInput
        aria-label={t("call_center_new_phone_label")}
        sizing="sm"
        defaultCountry="CL"
        value={toE164(draft.phone)}
        onChange={(phone) => setDraft({ ...draft, phone: phone ?? "" })}
      />

      <TextInput
        sizing="sm"
        aria-label={t("call_center_new_name_label")}
        placeholder={t("call_center_new_name_placeholder")}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={!canSubmitNewNumber(draft, "call")}
          className="flex items-center justify-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <HiPhone className="h-4 w-4" />
          {t("call_center_new_call_only")}
        </button>
        <button
          type="button"
          disabled={!canSubmitNewNumber(draft, "callAndSave")}
          onClick={() => submit("callAndSave")}
          className="flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <HiOutlineBookmark className="h-4 w-4" />
          {t("call_center_new_call_and_save")}
        </button>
      </div>
    </form>
  );
}
