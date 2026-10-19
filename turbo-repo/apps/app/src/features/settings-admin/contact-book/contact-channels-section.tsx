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
import HoverTooltip from "./hover-tooltip";
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

/** The icon box attached to the input's right edge: gray until the channel
 *  is configured, green once it is. */
const ICON_BOX_TONES: Record<ChannelFieldStatus, string> = {
  empty: "border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400",
  active: "border-green-500 bg-green-100 text-green-700 dark:border-green-400 dark:bg-green-500/20 dark:text-green-300",
};

const STATUS_DOT_TONES: Record<ChannelFieldStatus, string> = {
  empty: "bg-gray-300 dark:bg-gray-600",
  active: "bg-green-500 dark:bg-green-400",
};

const STATUS_TEXT_TONES: Record<ChannelFieldStatus, string> = {
  empty: "text-gray-400 dark:text-gray-500",
  active: "text-green-700 dark:text-green-300",
};

const STATUS_KEYS: Record<ChannelFieldStatus, string> = {
  empty: "channelInactive",
  active: "channelActive",
};

/** Squares the input's right corners so the icon box sits flush against it. */
const INPUT_ATTACHED_RIGHT = "rounded-l-lg rounded-r-none";

/** The phone number sits between the country selector and the icon box, so
 *  it's square on both sides. */
const PHONE_INPUT_ATTACHED_BOTH = "rounded-none";

/** Same card as the contact table's method tooltips: the method's icon, its
 *  name, and whether it's set up. */
function ChannelTooltipContent({
  method,
  label,
  status,
  statusLabel,
}: Readonly<{
  method: CallMethod;
  label: string;
  status: ChannelFieldStatus;
  statusLabel: string;
}>) {
  const Icon = CALL_METHOD_ICONS[method];
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_TEXT_TONES[status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_TONES[status]}`} />
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

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
  const statusLabel = trDynamic(STATUS_KEYS[status], d);

  return (
    <div className="flex min-w-0">
      {isPhoneMethod(method) ? (
        <PhoneInput
          aria-label={label}
          className="min-w-0 flex-1"
          inputClassName={PHONE_INPUT_ATTACHED_BOTH}
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
          theme={{ field: { input: { withAddon: { off: INPUT_ATTACHED_RIGHT } } } }}
          sizing="sm"
          color={inputValidationColor(value, status === "active")}
          placeholder={PLACEHOLDERS[method]}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <HoverTooltip
        content={<ChannelTooltipContent method={method} label={label} status={status} statusLabel={statusLabel} />}
      >
        <span
          className={`inline-flex shrink-0 items-center rounded-r-lg border border-l-0 px-2.5 transition-colors ${ICON_BOX_TONES[status]}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">{statusLabel}</span>
        </span>
      </HoverTooltip>
    </div>
  );
}

/**
 * Contacto card — every channel is a single input with its method's icon
 * attached on the right; typing a valid number/email is what activates it
 * (the icon turns green — no separate switch).
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
