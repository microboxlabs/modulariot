"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { HiChevronLeft } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { CelField } from "@/features/symptoms/maintainer/cel-editor";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import {
  type SymptomFamily,
  useControlTowerAccess,
} from "@/features/symptoms/maintainer/maintainer-api";
import { familyOptions } from "@/features/symptoms/maintainer/sheet-header";
import {
  canonicalFamily,
  familyLabel,
} from "@/features/symptoms/maintainer/symptom-labels";
import { PillSelect } from "@/features/symptoms/maintainer/ui/pill";
import { Problems } from "@/features/symptoms/maintainer/rule-problems";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import NumberedSection from "@/features/symptoms/maintainer/ui/section";
import SheetTop from "@/features/symptoms/maintainer/ui/sheet-top";
import { StateToggle } from "@/features/symptoms/maintainer/ui/state";
import AudienceList from "./audience-list";
import {
  refreshRules,
  setRuleState,
  simulateRule,
  useConversationTemplates,
  useEventCatalog,
  useRuleFamilies,
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
  eventVariables,
  normalizeSpec,
  ruleBump,
  ruleChanges,
  sampleEvent,
  triggerSummary,
} from "./rule-model";
import { RuleReviewPanel, VariablesPanel } from "./rule-side-panel";
import RuleSteps from "./rule-steps";
import RuleTriggerSection from "./rule-trigger";
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

function RuleHeader({
  name,
  ruleKey,
  version,
  state,
  family,
  publishedFamily,
  families,
  familiesMissing,
  canSetState,
  canEdit,
  backHref,
  lang,
  d,
  onState,
  onFamily,
  actions,
}: Readonly<{
  name: string;
  ruleKey: string;
  version: string | null;
  state: RuleState;
  family: string | null;
  publishedFamily: string | null;
  families: SymptomFamily[] | undefined;
  familiesMissing: boolean;
  canSetState: boolean;
  canEdit: boolean;
  backHref: string;
  lang: string;
  d: I18nRecord;
  onState: (state: RuleState) => void;
  onFamily: (family: string | null) => void;
  /** The draft's changes and actions, shown before the state. */
  actions?: ReactNode;
}>) {
  const value = canonicalFamily(family, families);
  return (
    <div className="flex flex-wrap items-start gap-3 lg:flex-nowrap">
      <Link
        href={backHref}
        aria-label={tr("backToRules", d)}
        title={tr("backToRules", d)}
        className={`mt-1.5 rounded p-1 ${MUTED} hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white`}
      >
        <HiChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold break-words text-gray-900 dark:text-white">
            {name}
          </h1>
          <span className="rounded-md border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 dark:border-gray-600 dark:text-gray-200">
            {version ? `v${version}` : tr("unpublished", d)}
          </span>
        </div>
        <div
          className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${MUTED}`}
        >
          <span>{tr("familyWord", d)}</span>
          {canEdit ? (
            <PillSelect
              ariaLabel={tr("familyWord", d)}
              value={value ?? ""}
              options={familyOptions(families, value, lang)}
              changed={
                value !== canonicalFamily(publishedFamily, families) &&
                version !== null
              }
              className="!text-xs"
              onChange={(next) => {
                if ((next || null) !== value) onFamily(next || null);
              }}
            />
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">
              {familyLabel(value, families, lang) || "—"}
            </span>
          )}
          <span>
            ·{" "}
            {familiesMissing
              ? tr("familyListMissing", d)
              : tr("familySource", d)}
          </span>
          <span>
            · <span className="font-mono">{ruleKey}</span>
          </span>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3">
        {actions}
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
    discarding,
    saveError,
    update,
    flush,
    publish,
    discard,
    mutate,
  } = useRuleDraft(id);
  const { data: catalog } = useEventCatalog();
  const { data: templates } = useConversationTemplates();
  const { data: families, error: familiesError } = useRuleFamilies();
  const symptomName = useSymptomNames();
  const [reviewing, setReviewing] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const info = catalog?.find((e) => e.type === spec?.trigger.event);
  const fields = useMemo(() => eventCelFields(info), [info]);
  const trigger = spec?.trigger;
  const sample = useMemo(
    () => sampleEvent(trigger ?? { event: "", when: null }, info),
    [trigger, info]
  );
  const current = detail?.current?.spec;
  // Compared the way the draft is read, so defaults the stored spec leaves out are no change.
  const published = useMemo(
    () => (current ? normalizeSpec(current) : null),
    [current]
  );
  const changes = useMemo(
    () => (spec ? ruleChanges(spec, published, d) : []),
    [spec, published, d]
  );
  const bump = useMemo(
    () => (spec ? ruleBump(spec, published) : null),
    [spec, published]
  );
  const changedKeys = new Set(changes.map((c) => c.key));
  const readOnly = !canMaintain || discarding;
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

  const showBar = canMaintain && Boolean(detail?.draft || saving || saveError);

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
      <div className="min-h-0 flex-1 overflow-y-auto dark:bg-gray-900">
        <SheetTop>
          {rule && (
            <RuleHeader
              name={rule.name}
              ruleKey={rule.key}
              version={rule.currentVersion}
              state={rule.state}
              family={spec?.family ?? null}
              publishedFamily={published?.family ?? null}
              families={families}
              familiesMissing={
                familiesError instanceof ControlTowerError &&
                familiesError.status === 404
              }
              canSetState={
                canMaintain && !discarding && rule.currentVersion !== null
              }
              canEdit={canMaintain && !discarding && spec !== null}
              backHref={backHref}
              lang={lang}
              d={d}
              onState={(s) => void changeState(s)}
              onFamily={(family) => set({ family })}
              actions={
                <>
                  {stateError && (
                    <span
                      role="alert"
                      className="max-w-56 break-words text-right text-xs text-red-600 dark:text-red-400"
                    >
                      {stateError}
                    </span>
                  )}
                  {showBar && (
                    <RuleDraftBar
                      changes={changes}
                      errors={errors}
                      saving={saving}
                      discarding={discarding}
                      saveError={saveError}
                      current={rule?.currentVersion ?? null}
                      bump={bump}
                      d={d}
                      onReview={() => setReviewing(true)}
                      onDiscard={
                        rule?.currentVersion
                          ? () =>
                              void discard().catch((e: unknown) =>
                                setStateError(
                                  e instanceof Error ? e.message : String(e)
                                )
                              )
                          : undefined
                      }
                    />
                  )}
                </>
              }
            />
          )}
        </SheetTop>
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pt-3 pb-10">
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {tr("loadFailed", d)}
            </p>
          )}
          {!detail && !error && (
            <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>
          )}
          {spec && detail && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
                <RuleTriggerSection
                  trigger={spec.trigger}
                  info={info}
                  catalog={catalog}
                  sample={sample}
                  fields={fields}
                  problems={placed.trigger.map((f) => ({
                    position: Math.max(0, f.position),
                    message: ruleFindingText(f, d),
                    severity: f.severity === "ERROR" ? "error" : "warning",
                  }))}
                  summary={triggerSummary(
                    spec.trigger,
                    d,
                    symptomName,
                    catalog
                  )}
                  changed={changedKeys.has("event") || changedKeys.has("when")}
                  readOnly={readOnly}
                  d={d}
                  formDict={dict?.symptomCatalog as I18nRecord}
                  onChange={(trigger) => set({ trigger })}
                />

                <NumberedSection
                  number={2}
                  title={tr("sectionAudience", d)}
                  subtitle={tr("sectionAudienceSub", d)}
                  changed={changedKeys.has("audience")}
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
                </NumberedSection>

                <NumberedSection
                  number={3}
                  title={tr("sectionSteps", d)}
                  subtitle={tr("sectionStepsSub", d)}
                  changed={changes.some((c) => c.key.startsWith("step"))}
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
                </NumberedSection>

                <NumberedSection
                  number={4}
                  title={tr("sectionSimulation", d)}
                  subtitle={tr("sectionSimulationSub", d)}
                >
                  <SimulationSection
                    key={`${spec.trigger.event}-${info ? "catalog" : ""}`}
                    initial={sample}
                    disabled={!canMaintain || discarding || !spec.trigger.event}
                    d={d}
                    onSimulate={simulate}
                  />
                </NumberedSection>
              </div>
              <div className="flex flex-col gap-4">
                <RuleReviewPanel findings={findings} d={d} />
                <VariablesPanel variables={eventVariables(info)} d={d} />
              </div>
            </div>
          )}
        </div>
      </div>
      <PublishRuleDialog
        open={reviewing}
        changes={changes}
        current={rule?.currentVersion ?? null}
        bump={bump}
        canPublish={
          canMaintain &&
          !discarding &&
          errors === 0 &&
          changes.length > 0 &&
          bump !== null &&
          saveError === null
        }
        d={d}
        onClose={() => setReviewing(false)}
        onPublish={async (reason, raise) => {
          await publish(reason, raise);
          setReviewing(false);
        }}
      />
    </div>
  );
}
