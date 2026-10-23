"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HiChevronLeft } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import CelEditor, {
  type CelField,
} from "@/features/symptoms/maintainer/cel-editor";
import { useControlTowerAccess } from "@/features/symptoms/maintainer/maintainer-api";
import { Problems } from "@/features/symptoms/maintainer/rule-problems";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { CHANGED_DOT } from "@/features/symptoms/maintainer/ui/changed";
import {
  FIELD,
  FieldRow,
  ResponseBlock,
} from "@/features/symptoms/maintainer/ui/response-block";
import Select from "@/features/symptoms/maintainer/ui/select";
import { StateToggle } from "@/features/symptoms/maintainer/ui/state";
import AudienceList from "./audience-list";
import {
  refreshRules,
  setRuleState,
  simulateRule,
  useConversationTemplates,
  useEventCatalog,
} from "./conversations-api";
import type {
  EventTypeInfo,
  RuleSpec,
  RuleState,
  SampleEvent,
} from "./conversations-types";
import RuleDraftBar, { PublishRuleDialog } from "./rule-draft-bar";
import { placeFindings, ruleFindingText } from "./rule-findings";
import {
  eventLabel,
  eventVariables,
  ruleChanges,
  sampleEvent,
  triggerSummary,
} from "./rule-model";
import { RuleReviewPanel, VariablesPanel } from "./rule-side-panel";
import RuleSteps from "./rule-steps";
import { COMMUNICATIONS_PAGE } from "./rules-tab";
import SimulationSection from "./simulation";
import { useRuleDraft } from "./use-rule-draft";
import { useSymptomNames } from "./use-symptom-names";

/** CEL paths of an event: its envelope and every data field. */
export function eventCelFields(info: EventTypeInfo | undefined): CelField[] {
  return [
    { path: "event.type", detail: "string" },
    { path: "event.test", detail: "bool" },
    { path: "event.at", detail: "timestamp" },
    { path: "event.context.kind", detail: "string" },
    { path: "event.context.key", detail: "string" },
    ...(info?.fields ?? []).map((f) => ({
      path: `event.data.${f.name}`,
      detail: [f.type, f.label].filter(Boolean).join(" · "),
    })),
  ];
}

function ChangedMark({ show, d }: Readonly<{ show: boolean; d: I18nRecord }>) {
  if (!show) return null;
  return (
    <span className={`flex items-center gap-1.5 text-xs ${MUTED}`}>
      <span className={`h-2 w-2 rounded-full ${CHANGED_DOT}`} />
      {tr("changedMark", d)}
    </span>
  );
}

function RuleHeader({
  name,
  ruleKey,
  version,
  state,
  canSetState,
  backHref,
  d,
  onState,
}: Readonly<{
  name: string;
  ruleKey: string;
  version: number | null;
  state: RuleState;
  canSetState: boolean;
  backHref: string;
  d: I18nRecord;
  onState: (state: RuleState) => void;
}>) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Link
        href={backHref}
        aria-label={tr("backToRules", d)}
        title={tr("backToRules", d)}
        className={`mt-1.5 rounded p-1 ${MUTED} hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white`}
      >
        <HiChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold break-words text-gray-900 dark:text-white">
          {name}
        </h1>
        <p className={`mt-1 flex flex-wrap gap-2 text-xs ${MUTED}`}>
          <span className="font-mono">{ruleKey}</span>
          <span>·</span>
          <span>{version ? `v${version}` : tr("unpublished", d)}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StateToggle
          value={state}
          d={d}
          disabled={!canSetState}
          onChange={(next) => {
            if (next !== state) onState(next);
          }}
        />
        {version === null && (
          <span className={`text-xs ${MUTED}`}>
            {tr("publishToActivate", d)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Settings › Comunicaciones › one rule: when, to whom, the steps, and a simulation. */
export default function RuleEditor({
  id,
  dict,
  lang,
}: Readonly<{ id: string; dict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const { canMaintain } = useControlTowerAccess();
  const {
    detail,
    error,
    spec,
    findings,
    saving,
    saveError,
    update,
    flush,
    publish,
    mutate,
  } = useRuleDraft(id);
  const { data: catalog } = useEventCatalog();
  const { data: templates } = useConversationTemplates();
  const symptomName = useSymptomNames();
  const [reviewing, setReviewing] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const info = catalog?.find((e) => e.type === spec?.trigger.event);
  const fields = useMemo(() => eventCelFields(info), [info]);
  const published = detail?.current?.spec ?? null;
  const changes = useMemo(
    () => (spec ? ruleChanges(spec, published, d) : []),
    [spec, published, d]
  );
  const changedKeys = new Set(changes.map((c) => c.key));
  const readOnly = !canMaintain;
  const errors = (findings ?? []).filter((f) => f.severity === "ERROR").length;
  const backHref = `/${lang}${COMMUNICATIONS_PAGE}`;
  const rule = detail?.rule;
  const set = (patch: Partial<RuleSpec>) => {
    if (spec) update({ ...spec, ...patch });
  };

  const changeState = async (state: RuleState) => {
    setStateError(null);
    try {
      const saved = await setRuleState(id, state);
      await mutate(
        (current) =>
          current
            ? { ...current, rule: { ...current.rule, ...saved } }
            : current,
        { revalidate: false }
      );
      await refreshRules();
    } catch (e) {
      setStateError(e instanceof Error ? e.message : String(e));
    }
  };

  const simulate = async (event: SampleEvent) => {
    await flush();
    return simulateRule(id, event);
  };

  const placed = spec
    ? placeFindings(findings, spec, d)
    : { trigger: [], audience: {}, audienceGeneral: [], steps: {} };

  const showBar = canMaintain && Boolean(detail?.draft || saving);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "communications"]}
          disableLinks
        />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-10 dark:bg-gray-900">
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {tr("loadFailed", d)}
          </p>
        )}
        {!detail && !error && (
          <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>
        )}
        {rule && (
          <RuleHeader
            name={rule.name}
            ruleKey={rule.key}
            version={rule.currentVersion}
            state={rule.state}
            canSetState={canMaintain && rule.currentVersion !== null}
            backHref={backHref}
            d={d}
            onState={(s) => void changeState(s)}
          />
        )}
        {stateError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {stateError}
          </p>
        )}
        {spec && detail && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
              <ResponseBlock
                title={tr("sectionWhen", d)}
                aside={
                  <ChangedMark
                    show={changedKeys.has("event") || changedKeys.has("when")}
                    d={d}
                  />
                }
              >
                <FieldRow label={tr("eventLabel", d)}>
                  <Select
                    aria-label={tr("eventLabel", d)}
                    className={FIELD}
                    wrapperClassName="min-w-56 flex-1"
                    disabled={readOnly}
                    value={spec.trigger.event}
                    onChange={(e) =>
                      set({
                        trigger: { ...spec.trigger, event: e.target.value },
                      })
                    }
                  >
                    <option value="">{tr("pickEvent", d)}</option>
                    {spec.trigger.event &&
                      !catalog?.some((e) => e.type === spec.trigger.event) && (
                        <option value={spec.trigger.event}>
                          {spec.trigger.event}
                        </option>
                      )}
                    {(catalog ?? []).map((e) => (
                      <option key={e.type} value={e.type}>
                        {eventLabel(e.type, d, catalog)}
                      </option>
                    ))}
                  </Select>
                </FieldRow>
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {tr("whenLabel", d)}
                  </span>
                  <CelEditor
                    readOnly={readOnly}
                    ariaLabel={tr("whenLabel", d)}
                    placeholder={tr("whenPlaceholder", d)}
                    value={spec.trigger.when ?? ""}
                    fields={fields}
                    problems={placed.trigger.map((f) => ({
                      position: Math.max(0, f.position),
                      message: ruleFindingText(f, d),
                      severity: f.severity === "ERROR" ? "error" : "warning",
                    }))}
                    onChange={(when) =>
                      set({ trigger: { ...spec.trigger, when: when || null } })
                    }
                  />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {triggerSummary(spec.trigger, d, symptomName, catalog)}
                  </p>
                </div>
              </ResponseBlock>

              <ResponseBlock
                title={tr("sectionAudience", d)}
                aside={<ChangedMark show={changedKeys.has("audience")} d={d} />}
              >
                <p className={`text-sm ${MUTED}`}>{tr("audienceHint", d)}</p>
                <Problems
                  items={placed.audienceGeneral.map((message) => ({
                    position: 0,
                    message,
                    severity: "error",
                  }))}
                />
                <AudienceList
                  entries={spec.audience}
                  fields={info?.fields ?? []}
                  errors={placed.audience}
                  readOnly={readOnly}
                  d={d}
                  label={tr("sectionAudience", d)}
                  onChange={(audience) => set({ audience })}
                />
              </ResponseBlock>

              <ResponseBlock
                title={tr("sectionSteps", d)}
                aside={
                  <ChangedMark
                    show={changes.some((c) => c.key.startsWith("step"))}
                    d={d}
                  />
                }
              >
                <RuleSteps
                  steps={spec.steps}
                  templates={templates ?? []}
                  fields={info?.fields ?? []}
                  errors={placed.steps}
                  readOnly={readOnly}
                  d={d}
                  onChange={(steps) => set({ steps })}
                />
              </ResponseBlock>

              <ResponseBlock title={tr("sectionSimulation", d)}>
                <SimulationSection
                  key={`${spec.trigger.event}-${info ? "catalog" : ""}`}
                  initial={sampleEvent(spec.trigger, info)}
                  disabled={!canMaintain || !spec.trigger.event}
                  d={d}
                  onSimulate={simulate}
                />
              </ResponseBlock>
            </div>
            <div className="flex flex-col gap-4">
              <RuleReviewPanel findings={findings} d={d} />
              <VariablesPanel variables={eventVariables(info)} d={d} />
            </div>
          </div>
        )}
        {showBar && (
          <RuleDraftBar
            changes={changes}
            errors={errors}
            saving={saving}
            saveError={saveError}
            nextVersion={(detail?.current?.version ?? 0) + 1}
            d={d}
            onReview={() => setReviewing(true)}
          />
        )}
      </div>
      <PublishRuleDialog
        open={reviewing}
        changes={changes}
        canPublish={canMaintain && errors === 0 && changes.length > 0}
        d={d}
        onClose={() => setReviewing(false)}
        onPublish={async (reason) => {
          await publish(reason);
          setReviewing(false);
        }}
      />
    </div>
  );
}
