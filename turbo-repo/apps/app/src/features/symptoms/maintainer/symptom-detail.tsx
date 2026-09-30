"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  TextInput,
} from "flowbite-react";
import { HiArrowLeft } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useIntegrationConfig } from "@/features/integration-config/use-integration-config";
import SymptomIcon from "../components/symtom-icon";
import type { CelField } from "./cel-editor";
import { keyFrom } from "./create-symptom-modal";
import {
  forkSymptom,
  refreshSymptoms,
  rollbackTo,
  setSymptomState,
  useDataSource,
  type SymptomState,
} from "./maintainer-api";
import PublishDialog from "./publish-dialog";
import { StateBadge, familyLabel, stateLabel } from "./symptom-labels";
import SymptomRuleSections from "./symptom-rule-sections";
import {
  FieldsPanel,
  PreviewPanel,
  ReviewPanel,
  VersionsPanel,
  originLabel,
} from "./symptom-side-panels";
import { useSymptomDraft } from "./use-symptom-draft";

type Pending =
  | { kind: "rollback"; version: string }
  | { kind: "fork"; version: string }
  | null;

/** The symptom page: its rules as editable CEL, checked and previewed by the server as you type. */
export default function SymptomDetail({
  id,
  dict,
  rootDict,
  lang,
}: Readonly<{
  id: string;
  dict: I18nRecord;
  rootDict: I18nRecord;
  lang: string;
}>) {
  const d = dict?.symptomCatalog as I18nRecord;
  const router = useRouter();
  const { activeOrg } = useOrgScopes();
  const canWrite = activeOrg?.role === "OWNER";
  const { connections } = useIntegrationConfig(activeOrg?.slug ?? null);
  const {
    detail,
    error,
    spec,
    update,
    report,
    preview,
    saving,
    saveError,
    discard,
    resync,
  } = useSymptomDraft(id, canWrite);
  const { data: source } = useDataSource(
    spec?.source ?? detail?.definition.sourceKey ?? null
  );
  const [publishing, setPublishing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [text, setText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const fields: CelField[] = useMemo(
    () =>
      (source?.fields ?? []).map((f) => ({
        path: f.path,
        detail: [f.type, f.unit, originLabel(f.origin, d)]
          .filter(Boolean)
          .join(" · "),
      })),
    [source, d]
  );

  const run = async (work: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await work();
      await refreshSymptoms();
      await resync();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    if (pending.kind === "rollback") {
      await run(() =>
        rollbackTo(id, pending.version, text.trim() || undefined)
      );
      setPending(null);
      return;
    }
    try {
      const created = await forkSymptom(id, {
        version: pending.version,
        key: keyFrom(text),
        name: text.trim(),
      });
      await refreshSymptoms();
      setPending(null);
      router.push(`/${lang}/users/settings/symptoms/${created.definition.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  const def = detail?.definition;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "symptomCatalog"]}
          disableLinks
        />
      </div>
      <div className="mx-auto flex w-full max-w-screen-2xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-10 dark:bg-gray-900">
        <Link
          href={`/${lang}/users/settings/symptoms`}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          {tr("backToCatalog", d)}
        </Link>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("loadFailed", d)}
          </p>
        )}
        {def && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-200">
              <SymptomIcon
                type={def.icon ?? def.name}
                dict={rootDict}
                size="h-10 w-10"
                fixed_label={def.name}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold text-gray-900 dark:text-white">
                {def.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {familyLabel(def.family)}
                {def.currentVersion
                  ? ` · v${def.currentVersion}`
                  : ` · ${tr("unpublished", d)}`}
              </p>
            </div>
            {canWrite && def.currentVersion ? (
              <Select
                sizing="sm"
                aria-label={tr("state", d)}
                value={def.state}
                onChange={(e) =>
                  void run(() =>
                    setSymptomState(id, e.target.value as SymptomState)
                  )
                }
              >
                {(["OFF", "TEST", "ACTIVE"] as const).map((s) => (
                  <option key={s} value={s}>
                    {stateLabel(s, d)}
                  </option>
                ))}
              </Select>
            ) : (
              <StateBadge state={def.state} d={d} />
            )}
          </div>
        )}

        {canWrite && detail?.draft && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-sm text-blue-900 dark:text-blue-200">
              {tr("draftBar", d)} · {saving ? tr("saving", d) : tr("saved", d)}
            </span>
            {saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                size="xs"
                color="alternative"
                onClick={() => void run(discard)}
              >
                {tr("discard", d)}
              </Button>
              <Button size="xs" onClick={() => setPublishing(true)}>
                {tr("publish", d)}
              </Button>
            </div>
          </div>
        )}
        {actionError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {actionError}
          </p>
        )}

        {spec && detail && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <SymptomRuleSections
                spec={spec}
                sourceFields={fields}
                findings={report?.findings}
                readOnly={!canWrite}
                d={d}
                rootDict={rootDict}
                connections={connections}
                lang={lang}
                onChange={update}
              />
            </div>
            <div className="flex flex-col gap-4">
              <ReviewPanel report={report} d={d} />
              <PreviewPanel preview={preview} d={d} rootDict={rootDict} />
              <FieldsPanel source={source} d={d} />
              <VersionsPanel
                versions={detail.versions}
                current={detail.definition.currentVersion}
                canWrite={canWrite}
                d={d}
                onRollback={(version) => {
                  setText("");
                  setPending({ kind: "rollback", version });
                }}
                onFork={(version) => {
                  setText("");
                  setPending({ kind: "fork", version });
                }}
              />
            </div>
          </div>
        )}
      </div>

      <PublishDialog
        id={id}
        open={publishing}
        d={d}
        onClose={() => setPublishing(false)}
        onPublished={() => {
          setPublishing(false);
          void refreshSymptoms();
          void resync();
        }}
      />

      <Modal show={pending !== null} size="md" onClose={() => setPending(null)}>
        <ModalHeader>
          {pending?.kind === "fork"
            ? tr("duplicateTitle", d, { version: pending.version })
            : tr("restoreTitle", d, { version: pending?.version ?? "" })}
        </ModalHeader>
        <ModalBody>
          <Label htmlFor="pending-text">
            {pending?.kind === "fork" ? tr("name", d) : tr("reason", d)}
          </Label>
          <TextInput
            id="pending-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">
            {pending?.kind === "fork"
              ? tr("duplicateHint", d)
              : tr("restoreHint", d)}
          </p>
        </ModalBody>
        <ModalFooter className="justify-end">
          <Button color="alternative" onClick={() => setPending(null)}>
            {tr("cancel", d)}
          </Button>
          <Button
            disabled={pending?.kind === "fork" && !text.trim()}
            onClick={() => void confirmPending()}
          >
            {pending?.kind === "fork" ? tr("duplicate", d) : tr("restore", d)}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
