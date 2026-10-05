"use client";

import { TextInput } from "flowbite-react";
import PhoneInput, { isValidPhone, toE164 } from "@/features/common/components/phone-input/phone-input";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import {
  ALL_CALL_METHODS,
  CALL_METHOD_ICONS,
  type CallMethod,
} from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import { isChannelValueValid } from "./contact-form-fields";
import { inputValidationColor } from "./input-validation";

export type ChannelValues = Record<CallMethod, string>;

export type ChannelFieldStatus = "empty" | "active";

export function emptyChannelValues(): ChannelValues {
  return { phone: "", whatsapp: "", meet: "", teams: "" };
}

/** Phone and WhatsApp take a number with country code (see PhoneInput). */
function isPhoneMethod(method: CallMethod): boolean {
  return method === "phone" || method === "whatsapp";
}

/** A channel is activated by configuring it: a valid address = active,
 *  anything else (empty or not valid yet) = not set up. Numbers are checked
 *  per country (libphonenumber); emails with the contact book's rule. */
export function channelFieldStatus(method: CallMethod, value: string): ChannelFieldStatus {
  if (!value.trim()) return "empty";
  const valid = isPhoneMethod(method) ? isValidPhone(value) : isChannelValueValid(method, value);
  return valid ? "active" : "empty";
}

/** Applies an edit to one channel. WhatsApp follows the phone number while
 *  it's empty or still identical to it; once it's set to a different number
 *  it's left alone. */
export function updateChannel(values: ChannelValues, method: CallMethod, next: string): ChannelValues {
  const updated = { ...values, [method]: next };
  const whatsappFollowsPhone = values.whatsapp === "" || values.whatsapp === values.phone;
  if (method === "phone" && whatsappFollowsPhone) updated.whatsapp = next;
  return updated;
}

const PLACEHOLDERS: Record<CallMethod, string> = {
  phone: "+56 9 …",
  whatsapp: "+56 9 …",
  meet: "nombre@gmail.com",
  teams: "nombre@empresa.com",
};

const INPUT_TYPES: Record<CallMethod, string> = {
  phone: "tel",
  whatsapp: "tel",
  meet: "email",
  teams: "email",
};

const LABEL_KEYS: Record<CallMethod, string> = {
  phone: "methodPhone",
  whatsapp: "methodWhatsapp",
  meet: "methodMeet",
  teams: "methodTeams",
};

const BOX_TONES: Record<ChannelFieldStatus, string> = {
  empty: "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
  active: "border-green-300 bg-green-50/60 dark:border-green-600/50 dark:bg-green-900/10",
};

const ICON_TONES: Record<ChannelFieldStatus, string> = {
  empty: "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500",
  active: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
};

const STATUS_TONES: Record<ChannelFieldStatus, string> = {
  empty: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  active: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
};

const STATUS_KEYS: Record<ChannelFieldStatus, string> = {
  empty: "channelInactive",
  active: "channelActive",
};

function ChannelField({
  method,
  value,
  onChange,
  d,
}: Readonly<{
  method: CallMethod;
  value: string;
  onChange: (next: string) => void;
  d: I18nRecord;
}>) {
  const Icon = CALL_METHOD_ICONS[method];
  const status = channelFieldStatus(method, value);

  const label = trDynamic(LABEL_KEYS[method], d);

  return (
    <div className={`flex items-center gap-2 rounded-lg border p-1.5 transition-colors ${BOX_TONES[status]}`}>
      <span
        title={label}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${ICON_TONES[status]}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      {isPhoneMethod(method) ? (
        <PhoneInput
          aria-label={label}
          className="min-w-0 flex-1"
          sizing="sm"
          defaultCountry="CL"
          value={toE164(value)}
          onChange={(next) => onChange(next ?? "")}
        />
      ) : (
        <TextInput
          type={INPUT_TYPES[method]}
          aria-label={label}
          className="min-w-0 flex-1"
          sizing="sm"
          color={inputValidationColor(value, status === "active")}
          placeholder={PLACEHOLDERS[method]}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <span className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONES[status]}`}>
        {trDynamic(STATUS_KEYS[status], d)}
      </span>
    </div>
  );
}

/**
 * Contacto card — every channel shows its configuration field right away;
 * typing a valid number/email is what activates it (no separate switch).
 * WhatsApp fills itself from the phone number unless given its own.
 */
export default function ContactChannelsSection({
  values,
  onChange,
  d,
}: Readonly<{
  values: ChannelValues;
  onChange: (next: ChannelValues) => void;
  d: I18nRecord;
}>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL_CALL_METHODS.map((m) => (
          <ChannelField
            key={m}
            method={m}
            value={values[m]}
            onChange={(next) => onChange(updateChannel(values, m, next))}
            d={d}
          />
        ))}
      </div>
    </div>
  );
}
