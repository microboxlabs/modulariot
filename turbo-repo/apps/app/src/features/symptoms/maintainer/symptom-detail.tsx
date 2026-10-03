"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useIntegrationConfig } from "@/features/integration-config/use-integration-config";
import type { CelField } from "./cel-editor";
import { keyFrom } from "./create-symptom-modal";
import {
  forkSymptom,
  refreshSymptoms,
  rollbackTo,
  useDataSource,
  usePublishPlan,
  useSymptomFamilies,
  useSymptomTemplates,
} from "./maintainer-api";
import DraftBar from "./draft-bar";
import PublishDialog from "./publish-dialog";
import SheetHeader from "./sheet-header";
import SymptomRuleSections from "./symptom-rule-sections";
import {
  FieldsPanel,
  PreviewPanel,
  ReviewPanel,
  VersionsPanel,
  originLabel,
} from "./symptom-side-panels";
import { useSymptomDraft } from "./use-symptom-draft";

/** The name a copy starts with, as in the prototype: "Exceso de velocidad (variante)". */
function variantName(name: string, d: I18nRecord) {
  return tr("variantName", d, { name });
}

/** The versions panel, which the version menu scrolls to. */
const VERSIONS_ID = "symptom-versions";

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
  const { connections } = useIntegrationConfig(
    // Connections are listed for owners only; others see the saved choice.
    canWrite ? (activeOrg?.slug ?? null) : null
  );
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
  const { data: families } = useSymptomFamilies();
  const { data: templates } = useSymptomTemplates(true);
  const { data: plan, error: planError } = usePublishPlan(
    id,
    Boolean(canWrite && detail?.draft)
  );
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
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("loadFailed", d)}
          </p>
        )}
        {def && (
          <SheetHeader
            def={def}
            spec={spec}
            canWrite={canWrite}
            families={families}
            templates={templates}
            forkedFrom={detail?.forkedFrom ?? null}
            backHref={`/${lang}/users/settings/symptoms`}
            lang={lang}
            d={d}
            rootDict={rootDict}
            onChange={update}
            onHistory={() =>
              document
                .getElementById(VERSIONS_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            onDuplicate={() => {
              if (!def.currentVersion) return;
              setText(variantName(def.name, d));
              setPending({ kind: "fork", version: def.currentVersion });
            }}
          />
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
              <div id={VERSIONS_ID} className="scroll-mt-4">
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
                    setText(variantName(detail.definition.name, d));
                    setPending({ kind: "fork", version });
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {canWrite && detail?.draft && (
          <DraftBar
            plan={plan}
            planFailed={Boolean(planError)}
            report={report}
            saving={saving}
            saveError={saveError}
            d={d}
            onReview={() => setPublishing(true)}
            onDiscard={() => void run(discard)}
          />
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
            ? tr("duplicateAsNew", d)
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
              ? tr("duplicateHint", d, { version: pending.version })
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
