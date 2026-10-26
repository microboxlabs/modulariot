"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Select, Textarea, TextInput } from "flowbite-react";
import { HiArrowLeft, HiPlus } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  bodyOf,
  discardDraft,
  newRule,
  publishMonitor,
  saveDraft,
  TRIGGERS,
  useCanEditMonitors,
  useMonitor,
  useScopeCheck,
  useScopeValues,
  type MonitorBody,
  type Rule,
  type Trigger,
} from "./monitors-api";
import { ParamsEditor, PlanEditor } from "./plan-params";
import RuleCard from "./rule-card";
import { ConfirmersPanel } from "./confirmers-panel";
import ScopeEditor from "./scope-section";

function versionAttribution(
  version: {
    status: string;
    publishedBy: string | null;
    publishedAt: string | null;
    updatedBy: string | null;
    updatedAt: string | null;
  },
  lang: string
) {
  const published = version.status === "published";
  const actor = published ? version.publishedBy : version.updatedBy;
  const at = published ? version.publishedAt : version.updatedAt;
  return `${actor ?? ""} · ${at ? new Date(at).toLocaleString(lang) : ""}`;
}

function Section({
  title,
  hint,
  children,
}: Readonly<{ title: string; hint?: string; children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {hint && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Settings › Viajes › one monitor: its draft, edited here and published as a
 * new version. Without the monitor permission it is read-only.
 */
export default function MonitorEditor({
  monitorKey,
  dict,
  lang,
}: Readonly<{ monitorKey: string; dict: I18nRecord; lang: string }>) {
  const d = dict?.tripMonitors as I18nRecord;
  const router = useRouter();
  const { data: detail, error, isLoading } = useMonitor(monitorKey);
  const canEdit = useCanEditMonitors();
  const base = detail?.draft ?? detail?.published ?? null;

  const [body, setBody] = useState<MonitorBody | null>(null);
  // Rule keys change while typed; these ids keep each card mounted.
  const [ids, setIds] = useState<number[]>([]);
  const [nextId, setNextId] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [newTrigger, setNewTrigger] = useState<Trigger>("signal");

  useEffect(() => {
    if (base && !dirty) {
      setBody(bodyOf(base));
      setIds(base.rules.map((_, i) => i));
      setNextId(base.rules.length);
    }
  }, [base, dirty]);

  const readOnly = !canEdit || busy;
  const findings = useMemo(() => detail?.draft?.findings ?? [], [detail]);
  const { data: scopeValues } = useScopeValues();
  const {
    data: savedCheck,
    error: scopeCheckError,
    isLoading: scopeChecking,
  } = useScopeCheck(monitorKey, detail?.draft?.scope ?? null);
  // Publishing waits for the check: a scope not yet checked could be a duplicate.
  const unchecked =
    !!detail?.draft?.scope &&
    (!savedCheck || scopeChecking || !!scopeCheckError);
  const duplicated =
    savedCheck?.overlaps.some((o) => o.relation === "DUPLICATE") ?? false;
  const publishBlocked = findings.length > 0 || duplicated || unchecked;

  const change = (patch: Partial<MonitorBody>) => {
    setBody((b) => (b ? { ...b, ...patch } : b));
    setDirty(true);
    setMessage(null);
  };
  const setRule = (i: number, r: Rule) =>
    change({ rules: body!.rules.map((x, j) => (j === i ? r : x)) });
  const removeRule = (i: number) => {
    change({ rules: body!.rules.filter((_, j) => j !== i) });
    setIds(ids.filter((_, j) => j !== i));
  };
  const addRule = () => {
    change({
      rules: [
        ...body!.rules,
        newRule(
          newTrigger,
          body!.rules.map((r) => r.key)
        ),
      ],
    });
    setIds([...ids, nextId]);
    setNextId(nextId + 1);
  };

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setDirty(false);
      setMessage(done);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const listHref = `/${lang}/users/settings/trips`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "trips"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-10 dark:bg-gray-900">
        <Link
          href={listHref}
          className="flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          {tr("backToList", d)}
        </Link>

        {isLoading && (
          <p className="text-sm text-gray-500">{tr("loading", d)}</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {error.message}
          </p>
        )}

        {detail && body && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {body.name || monitorKey}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-mono">{monitorKey}</span>
                  {detail.published && (
                    <Badge color="success">
                      {tr("publishedVersion", d, {
                        version: String(detail.published.version),
                      })}
                    </Badge>
                  )}
                  {detail.draft && (
                    <Badge color="warning">
                      {tr("draftVersion", d, {
                        version: String(detail.draft.version),
                      })}
                    </Badge>
                  )}
                  {dirty && <Badge color="gray">{tr("unsaved", d)}</Badge>}
                </div>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-2">
                  {detail.draft && (
                    <Button
                      color="light"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirmDiscard(true)}
                    >
                      {tr("discardDraft", d)}
                    </Button>
                  )}
                  <Button
                    color="alternative"
                    size="sm"
                    disabled={busy || !dirty}
                    onClick={() =>
                      run(() => saveDraft(monitorKey, body), tr("saved", d))
                    }
                  >
                    {tr("saveDraft", d)}
                  </Button>
                  <Button
                    color="blue"
                    size="sm"
                    disabled={busy || dirty || !detail.draft || publishBlocked}
                    title={publishBlocked ? tr("publishBlocked", d) : undefined}
                    onClick={() =>
                      run(() => publishMonitor(monitorKey), tr("published", d))
                    }
                  >
                    {tr("publish", d)}
                  </Button>
                </div>
              )}
            </div>

            {message && (
              <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {message}
              </p>
            )}
            {!detail.draft && canEdit && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("editingPublished", d)}
              </p>
            )}

            <Section title={tr("general", d)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr("name", d)}
                  </span>
                  <TextInput
                    sizing="sm"
                    value={body.name}
                    disabled={readOnly}
                    aria-label={tr("name", d)}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr("descriptionLabel", d)}
                  </span>
                  <Textarea
                    rows={2}
                    value={body.description ?? ""}
                    disabled={readOnly}
                    aria-label={tr("descriptionLabel", d)}
                    onChange={(e) =>
                      change({ description: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </Section>

            <Section title={tr("scope.title", d)} hint={tr("scope.hint", d)}>
              <ScopeEditor
                monitorKey={monitorKey}
                scope={body.scope}
                values={scopeValues}
                readOnly={readOnly}
                onChange={(scope) => change({ scope })}
                d={d}
              />
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title={tr("plan", d)} hint={tr("planHint", d)}>
                <PlanEditor
                  plan={body.plan}
                  readOnly={readOnly}
                  d={d}
                  onChange={(plan) => change({ plan })}
                />
              </Section>
              <Section title={tr("params", d)} hint={tr("paramsHint", d)}>
                <ParamsEditor
                  params={body.params}
                  readOnly={readOnly}
                  d={d}
                  onChange={(params) => change({ params })}
                />
              </Section>
            </div>

            <Section
              title={tr("confirmers.title", d)}
              hint={tr("confirmers.hint", d)}
            >
              <ConfirmersPanel monitor={monitorKey} canEdit={canEdit} d={d} />
            </Section>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {tr("rules", d)}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {tr("rulesHint", d)}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <Select
                      sizing="sm"
                      value={newTrigger}
                      disabled={readOnly}
                      aria-label={tr("trigger", d)}
                      onChange={(e) => setNewTrigger(e.target.value as Trigger)}
                    >
                      {TRIGGERS.map((t) => (
                        <option key={t} value={t}>
                          {tr(`triggers.${t}`, d)}
                        </option>
                      ))}
                    </Select>
                    <Button
                      color="light"
                      size="sm"
                      disabled={readOnly}
                      onClick={addRule}
                    >
                      <HiPlus className="mr-1 h-4 w-4" />
                      {tr("addRule", d)}
                    </Button>
                  </div>
                )}
              </div>
              {body.rules.length === 0 && (
                <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  {tr("rulesEmpty", d)}
                </p>
              )}
              {body.rules.map((r, i) => (
                <RuleCard
                  key={ids[i]}
                  number={i + 1}
                  rule={r}
                  params={body.params}
                  readOnly={readOnly}
                  d={d}
                  formDict={dict?.symptomCatalog as I18nRecord}
                  findings={
                    dirty ? [] : findings.filter((f) => f.ruleKey === r.key)
                  }
                  onChange={(next) => setRule(i, next)}
                  onRemove={() => removeRule(i)}
                />
              ))}
            </div>

            <Section title={tr("versions", d)}>
              <ul className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                {detail.versions.map((v) => (
                  <li key={v.version} className="flex gap-3">
                    <span className="w-10 font-mono">v{v.version}</span>
                    <span className="w-24">{tr(`status.${v.status}`, d)}</span>
                    <span className="text-gray-400">
                      {versionAttribution(v, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={async () => {
          setConfirmDiscard(false);
          const onlyDraft = !detail?.published;
          const discarded = await run(
            () => discardDraft(monitorKey),
            tr("discarded", d)
          );
          // A monitor that was never published is gone with its draft.
          if (discarded && onlyDraft) router.push(listHref);
        }}
        isProcessing={busy}
        variant="warning"
        title={tr("discardTitle", d)}
        description={tr("discardBody", d)}
        confirmLabel={tr("discardDraft", d)}
      />
    </div>
  );
}
