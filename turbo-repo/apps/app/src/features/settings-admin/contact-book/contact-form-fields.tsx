"use client";

import { useEffect, useRef, useState } from "react";
import {
  ALL_CALL_METHODS,
  CALL_METHOD_ICONS,
  type CallMethod,
} from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import type { BookContact } from "./store";

/** Derived, never stored: "off" while the switch is off, "configured" once
 *  it's on with a valid address, "active" while it's on but not valid yet. */
export type ChannelStatus = "off" | "active" | "configured";

export interface ChannelState {
  /** The channel's on/off switch. Turning it off clears the value. */
  enabled: boolean;
  value: string;
}

export type ChannelsValue = Record<CallMethod, ChannelState>;

export interface ContactFormValue {
  name: string;
  role: string;
  channels: ChannelsValue;
}

export interface ContactFormLabels {
  name: string;
  role: string;
  channelsTitle: string;
  unfinishedHint: string;
  states: Record<ChannelStatus, string>;
  actions: {
    useSamePhone: string;
  };
  methodLabels: Record<CallMethod, string>;
  fieldLabels: Record<CallMethod, string>;
}

const PLACEHOLDERS: Record<CallMethod, string> = {
  phone: "+56 9 …",
  whatsapp: "+56 9 …",
  teams: "nombre@empresa.com",
  meet: "nombre@gmail.com",
};

const INPUT_TYPES: Record<CallMethod, string> = {
  phone: "tel",
  whatsapp: "tel",
  teams: "email",
  meet: "email",
};

export function emptyChannels(): ChannelsValue {
  return {
    phone: { enabled: false, value: "" },
    whatsapp: { enabled: false, value: "" },
    teams: { enabled: false, value: "" },
    meet: { enabled: false, value: "" },
  };
}

export function isChannelValueValid(method: CallMethod, value: string): boolean {
  const v = value.trim();
  if (INPUT_TYPES[method] === "email") return v.includes("@") && v.length > 3;
  return v.replace(/\D/g, "").length >= 8;
}

export function channelStatus(
  method: CallMethod,
  state: ChannelState
): ChannelStatus {
  if (!state.enabled) return "off";
  return isChannelValueValid(method, state.value) ? "configured" : "active";
}

/** True while a channel is switched on but has no usable address yet. */
export function hasUnfinishedChannel(channels: ChannelsValue): boolean {
  return ALL_CALL_METHODS.some((m) => channelStatus(m, channels[m]) === "active");
}

/** Rebuilds the per-channel state from a stored contact. Contacts saved
 *  before channels existed only have `phone` + `methods`: phone/WhatsApp
 *  reuse that number, and a Teams/Meet method that was allowed but never
 *  given an address comes back switched on and empty so the gap is obvious. */
export function channelsFromContact(contact: BookContact | null): ChannelsValue {
  const channels = emptyChannels();
  if (!contact) return channels;
  for (const m of ALL_CALL_METHODS) {
    const legacyPhone = m === "phone" || m === "whatsapp" ? contact.phone : "";
    const value = contact.channels?.[m] ?? (contact.methods.includes(m) ? legacyPhone : "");
    const allowed = contact.methods.includes(m) || contact.channels?.[m] !== undefined;
    channels[m] = { enabled: allowed || Boolean(value), value };
  }
  return channels;
}

/** The stored shape: only channels with a valid address, plus the derived
 *  `phone` (primary number shown in lists) and `methods` (what the call flow
 *  offers). */
export function channelsToContact(
  channels: ChannelsValue
): Pick<BookContact, "channels" | "phone" | "methods"> {
  const configured: Partial<Record<CallMethod, string>> = {};
  for (const m of ALL_CALL_METHODS) {
    if (channels[m].enabled && isChannelValueValid(m, channels[m].value)) configured[m] = channels[m].value.trim();
  }
  return {
    channels: configured,
    phone: configured.phone ?? configured.whatsapp ?? "",
    methods: ALL_CALL_METHODS.filter((m) => configured[m] !== undefined),
  };
}

const BOX_TONES: Record<ChannelStatus, string> = {
  off: "border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800/40",
  active:
    "border-blue-300 bg-white dark:border-blue-700/60 dark:bg-gray-800",
  configured:
    "border-green-300 bg-green-50/60 dark:border-green-700/60 dark:bg-green-900/10",
};

const ICON_TONES: Record<ChannelStatus, string> = {
  off: "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  configured: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
};

const STATUS_TEXT_TONES: Record<ChannelStatus, string> = {
  off: "text-gray-400 dark:text-gray-500",
  active: "text-blue-700 dark:text-blue-300",
  configured: "text-green-700 dark:text-green-300",
};

/** One channel: an on/off switch that reveals the setup field. Switching on
 *  expands the box; a valid address is what makes it "Configurado". Switching
 *  off collapses it and clears what was typed. */
function ChannelBox({
  method,
  state,
  onChange,
  labels,
  inputClassName,
  phoneValue,
}: {
  readonly method: CallMethod;
  readonly state: ChannelState;
  readonly onChange: (next: ChannelState) => void;
  readonly labels: ContactFormLabels;
  readonly inputClassName: string;
  /** The phone channel's number, offered to WhatsApp as a shortcut. */
  readonly phoneValue: string;
}) {
  const Icon = CALL_METHOD_ICONS[method];
  const status = channelStatus(method, state);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.enabled && !state.value) inputRef.current?.focus();
    // Only when the switch flips on — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.enabled]);

  const toggle = () =>
    onChange(state.enabled ? { enabled: false, value: "" } : { enabled: true, value: "" });

  return (
    <div className={`rounded-xl border transition-colors ${BOX_TONES[status]}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${ICON_TONES[status]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-medium ${
              state.enabled
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {labels.methodLabels[method]}
          </span>
          <span
            className={`block truncate text-xs font-medium ${STATUS_TEXT_TONES[status]}`}
          >
            {labels.states[status]}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-label={labels.methodLabels[method]}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
            state.enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              state.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {state.enabled && (
        <div className="flex flex-col gap-2 border-t border-black/5 px-3 pb-3 pt-2.5 dark:border-white/10">
          <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {labels.fieldLabels[method]}
          </label>
          <input
            ref={inputRef}
            type={INPUT_TYPES[method]}
            className={inputClassName}
            placeholder={PLACEHOLDERS[method]}
            value={state.value}
            onChange={(e) => onChange({ ...state, value: e.target.value })}
          />
          {method === "whatsapp" && phoneValue && state.value !== phoneValue && (
            <button
              type="button"
              className="self-start text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => onChange({ ...state, value: phoneValue })}
            >
              {labels.actions.useSamePhone}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The one add/edit-contact form, shared by Settings › Libreta de contactos
 * and the call-center's add-contact button. Name and role on top (role is
 * free text, suggested from roles already in use), then one box per calling
 * channel. Each box has an on/off switch; switching on reveals its setup field, and
 * a valid address makes it "Configurado". Only such channels become part of
 * the contact.
 */
export default function ContactFormFields({
  value,
  onChange,
  roleSuggestionsSource,
  labels,
  inputClassName,
  autoFocusName = true,
  inlineSuggestions = false,
}: {
  readonly value: ContactFormValue;
  readonly onChange: (next: ContactFormValue) => void;
  readonly roleSuggestionsSource: readonly string[];
  readonly labels: ContactFormLabels;
  readonly inputClassName: string;
  readonly autoFocusName?: boolean;
  /** Render role suggestions in normal flow (growing the form) instead of
   *  an overlay — for containers that clip overflow, like a fit-content modal. */
  readonly inlineSuggestions?: boolean;
}) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roleMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (!roleFieldRef.current?.contains(e.target as Node)) setRoleMenuOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [roleMenuOpen]);

  const roleQuery = value.role.trim().toLowerCase();
  const suggestions = Array.from(new Set(roleSuggestionsSource)).filter(
    (r) => r.toLowerCase() !== roleQuery && (!roleQuery || r.toLowerCase().includes(roleQuery))
  );

  const setChannel = (method: CallMethod, next: ChannelState) => {
    onChange({ ...value, channels: { ...value.channels, [method]: next } });
  };

  const phoneValue =
    channelStatus("phone", value.channels.phone) === "configured"
      ? value.channels.phone.value
      : "";

  return (
    <div className="flex flex-col gap-3">
      <input
        autoFocus={autoFocusName}
        className={inputClassName}
        placeholder={labels.name}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <div ref={roleFieldRef} className="relative">
        <input
          className={inputClassName}
          placeholder={labels.role}
          value={value.role}
          onChange={(e) => {
            onChange({ ...value, role: e.target.value });
            setRoleMenuOpen(true);
          }}
          onFocus={() => setRoleMenuOpen(true)}
        />
        {roleMenuOpen && suggestions.length > 0 && (
          <div
            className={`${inlineSuggestions ? "mt-1" : "absolute left-0 right-0 top-full z-30 mt-1"} max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800`}
          >
            {suggestions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onChange({ ...value, role: r });
                  setRoleMenuOpen(false);
                }}
                className="block w-full truncate px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {labels.channelsTitle}
        </span>
        {ALL_CALL_METHODS.map((m) => (
          <ChannelBox
            key={m}
            method={m}
            state={value.channels[m]}
            onChange={(next) => setChannel(m, next)}
            labels={labels}
            inputClassName={inputClassName}
            phoneValue={phoneValue}
          />
        ))}
        {hasUnfinishedChannel(value.channels) && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {labels.unfinishedHint}
          </p>
        )}
      </div>
    </div>
  );
}
