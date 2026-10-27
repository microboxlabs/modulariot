"use client";

import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  FIELD,
  FIELD_ERROR,
  FieldError,
} from "@/features/symptoms/maintainer/ui/response-block";
import Select from "@/features/symptoms/maintainer/ui/select";
import ContactsAudience from "./contacts-audience";
import type { AudienceEntry, EventField } from "./conversations-types";
import { audienceKind, ROLES, type AudienceKind } from "./rule-model";
import { useRowKeys } from "./row-keys";

export const ICON_BUTTON =
  "rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white";

const KINDS: { value: AudienceKind; label: string }[] = [
  { value: "role", label: "audienceRole" },
  { value: "address", label: "audienceAddress" },
  { value: "path", label: "audiencePath" },
  { value: "contacts", label: "audienceContacts" },
];

const NO_TEXTS: I18nRecord = {};

function entryOf(kind: AudienceKind): AudienceEntry {
  if (kind === "address") return { address: "", channel: "whatsapp", name: "" };
  if (kind === "path") return { path: "" };
  if (kind === "contacts") return { contacts: "" };
  return { role: "driver" };
}

function EntryFields({
  entry,
  fields,
  error,
  readOnly,
  d,
  fieldDict = NO_TEXTS,
  onChange,
}: Readonly<{
  entry: AudienceEntry;
  error: boolean;
  fields: EventField[];
  readOnly: boolean;
  d: I18nRecord;
  fieldDict?: I18nRecord;
  onChange: (entry: AudienceEntry) => void;
}>) {
  const kind = audienceKind(entry);
  const field = error ? `${FIELD} ${FIELD_ERROR}` : FIELD;
  if (kind === "contacts") {
    return (
      <ContactsAudience
        condition={entry.contacts ?? ""}
        fields={fields}
        readOnly={readOnly}
        d={d}
        fieldDict={fieldDict}
        onChange={(contacts) => onChange({ contacts })}
      />
    );
  }
  if (kind === "role") {
    const known = ROLES.some((r) => r.value === entry.role);
    return (
      <Select
        aria-label={tr("audienceRole", d)}
        className={field}
        wrapperClassName="min-w-44"
        disabled={readOnly}
        value={entry.role ?? ""}
        onChange={(e) => onChange({ role: e.target.value })}
      >
        {!known && <option value={entry.role}>{entry.role}</option>}
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {trDynamic(r.label, d)}
          </option>
        ))}
      </Select>
    );
  }
  if (kind === "path") {
    const known = fields.some((f) => f.name === entry.path);
    return (
      <Select
        aria-label={tr("audiencePath", d)}
        className={`${field} font-mono`}
        wrapperClassName="min-w-44 flex-1"
        disabled={readOnly}
        value={entry.path ?? ""}
        onChange={(e) => onChange({ path: e.target.value })}
      >
        <option value="">{tr("pickField", d)}</option>
        {!known && entry.path && (
          <option value={entry.path}>{entry.path}</option>
        )}
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name} · {f.label}
          </option>
        ))}
      </Select>
    );
  }
  return (
    <>
      <Select
        aria-label={tr("audienceChannel", d)}
        className={field}
        disabled={readOnly}
        value={entry.channel ?? "whatsapp"}
        onChange={(e) => onChange({ ...entry, channel: e.target.value })}
      >
        <option value="whatsapp">{tr("channelWhatsapp", d)}</option>
        <option value="email">{tr("channelEmail", d)}</option>
      </Select>
      <input
        aria-label={tr("audienceAddressValue", d)}
        className={`${field} min-w-40 flex-1`}
        disabled={readOnly}
        placeholder={
          entry.channel === "email" ? "nombre@example.com" : "+56900000000"
        }
        value={entry.address ?? ""}
        onChange={(e) => onChange({ ...entry, address: e.target.value })}
      />
      <input
        aria-label={tr("audienceName", d)}
        className={`${field} min-w-32 flex-1`}
        disabled={readOnly}
        placeholder={tr("audienceNamePlaceholder", d)}
        value={entry.name ?? ""}
        onChange={(e) => onChange({ ...entry, name: e.target.value })}
      />
    </>
  );
}

/** Who a rule writes to: roles of the event's context, fixed addresses, fields of the event, or contact book entries. */
export default function AudienceList({
  entries,
  fields,
  errors = {},
  readOnly,
  d,
  fieldDict = NO_TEXTS,
  label,
  onChange,
}: Readonly<{
  entries: AudienceEntry[];
  fields: EventField[];
  /** Finding texts by entry index. */
  errors?: Record<number, string[]>;
  readOnly: boolean;
  d: I18nRecord;
  /** The selectables field texts, for the contact book conditions. */
  fieldDict?: I18nRecord;
  /** Names the list for assistive tech. */
  label: string;
  onChange: (entries: AudienceEntry[]) => void;
}>) {
  const rows = useRowKeys(entries.length);
  const set = (i: number, entry: AudienceEntry) =>
    onChange(entries.map((e, j) => (j === i ? entry : e)));
  return (
    <div className="flex flex-col gap-2">
      {entries.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noAudience", d)}
        </p>
      )}
      {entries.length > 0 && (
        <ul
          aria-label={label}
          className="divide-y divide-gray-200 dark:divide-gray-700"
        >
          {entries.map((e, i) => (
            <li
              key={rows.keys[i]}
              className="flex items-start gap-2 py-2 text-sm first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Select
                  aria-label={tr("audienceKind", d)}
                  className={FIELD}
                  disabled={readOnly}
                  value={audienceKind(e)}
                  onChange={(ev) =>
                    set(i, entryOf(ev.target.value as AudienceKind))
                  }
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {trDynamic(k.label, d)}
                    </option>
                  ))}
                </Select>
                <EntryFields
                  entry={e}
                  fields={fields}
                  error={(errors[i] ?? []).length > 0}
                  readOnly={readOnly}
                  d={d}
                  fieldDict={fieldDict}
                  onChange={(next) => set(i, next)}
                />
                {(errors[i] ?? []).length > 0 && (
                  <div className="flex w-full flex-col gap-0.5">
                    {(errors[i] ?? []).map((text) => (
                      <FieldError key={text} text={text} />
                    ))}
                  </div>
                )}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={tr("removeAudience", d)}
                  className={`mt-1.5 ${ICON_BUTTON} hover:text-red-600 dark:hover:text-red-400`}
                  onClick={() => {
                    rows.remove(i);
                    onChange(entries.filter((_, j) => j !== i));
                  }}
                >
                  <HiX className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() => onChange([...entries, entryOf("role")])}
        >
          <HiPlus className="h-4 w-4" />
          {tr("addAudience", d)}
        </button>
      )}
    </div>
  );
}
