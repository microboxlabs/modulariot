"use client";

import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  FIELD,
  FieldError,
} from "@/features/symptoms/maintainer/ui/response-block";
import AudienceList, { ICON_BUTTON } from "./audience-list";
import type {
  EventField,
  RecipientGroup,
  RuleStep,
} from "./conversations-types";
import type { GroupIssues } from "./rule-findings";
import { groupLabel, newGroupId, writesToGroups } from "./rule-model";
import { useRowKeys } from "./row-keys";

const NO_TEXTS: I18nRecord = {};

/** The steps that write to a group, as "Paso 1, Paso 3". */
function usedBy(id: string, steps: RuleStep[], d: I18nRecord): string[] {
  return steps.flatMap((s, i) =>
    writesToGroups(s.channel) && s.to.includes(id)
      ? [tr("stepN", d, { n: String(i + 1) })]
      : []
  );
}

/** "A quién": named groups of recipients; each step picks the groups it writes to. */
export default function RecipientGroups({
  groups,
  steps,
  fields,
  errors = {},
  readOnly,
  d,
  fieldDict = NO_TEXTS,
  onChange,
}: Readonly<{
  groups: RecipientGroup[];
  steps: RuleStep[];
  fields: EventField[];
  errors?: Record<number, GroupIssues>;
  readOnly: boolean;
  d: I18nRecord;
  fieldDict?: I18nRecord;
  /** The new groups, and the steps without the groups that were removed. */
  onChange: (groups: RecipientGroup[], steps: RuleStep[]) => void;
}>) {
  const rows = useRowKeys(groups.length);
  const set = (i: number, patch: Partial<RecipientGroup>) =>
    onChange(
      groups.map((g, j) => (j === i ? { ...g, ...patch } : g)),
      steps
    );
  const remove = (i: number) => {
    const id = groups[i].id;
    rows.remove(i);
    onChange(
      groups.filter((_, j) => j !== i),
      steps.map((s) =>
        s.to.includes(id) ? { ...s, to: s.to.filter((x) => x !== id) } : s
      )
    );
  };
  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noGroups", d)}
        </p>
      )}
      <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
        {groups.map((g, i) => {
          const issues = errors[i];
          const label = groupLabel(g, i, d);
          const used = usedBy(g.id, steps, d);
          return (
            <section
              key={rows.keys[i]}
              aria-label={label}
              className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={tr("groupName", d)}
                  className={`${FIELD} min-w-40 flex-1 font-medium sm:max-w-72`}
                  disabled={readOnly}
                  placeholder={label}
                  value={g.name ?? ""}
                  onChange={(e) => set(i, { name: e.target.value || null })}
                />
                <code
                  title={tr("groupIdHint", d)}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {g.id}
                </code>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {used.length > 0
                    ? tr("groupUsedBy", d, { steps: used.join(", ") })
                    : tr("groupUnusedHint", d)}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={tr("removeGroup", d)}
                    className={`ml-auto ${ICON_BUTTON} hover:text-red-600 dark:hover:text-red-400`}
                    onClick={() => remove(i)}
                  >
                    <HiX className="h-4 w-4" />
                  </button>
                )}
              </div>
              {(issues?.messages ?? []).map((text) => (
                <FieldError key={text} text={text} />
              ))}
              <AudienceList
                entries={g.entries}
                fields={fields}
                errors={issues?.entries}
                readOnly={readOnly}
                d={d}
                fieldDict={fieldDict}
                label={label}
                onChange={(entries) => set(i, { entries })}
              />
            </section>
          );
        })}
      </div>
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange(
              [
                ...groups,
                {
                  id: newGroupId(groups),
                  name: null,
                  entries: [{ role: "driver" }],
                },
              ],
              steps
            )
          }
        >
          <HiPlus className="h-4 w-4" />
          {tr("addGroup", d)}
        </button>
      )}
    </div>
  );
}
