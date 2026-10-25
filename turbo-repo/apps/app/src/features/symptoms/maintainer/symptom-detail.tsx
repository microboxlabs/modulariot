"use client";

import { useEffect, useMemo, useState } from "react";
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
import { PLATFORM_SCOPE_SLUG } from "@/features/common/platform-scope";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useIsPlatformOwner } from "@/features/settings-admin/platform/use-platform-membership";
import type { CelField } from "./cel-editor";
import { keyFrom } from "./create-symptom-modal";
import {
  forkSymptom,
  refreshSymptoms,
  rollbackTo,
  useDataSource,
  usePublishPlan,
  useSymptomFamilies,
  useControlTowerAccess,
  familiesListMissing,
  useSymptomTemplates,
  type PublishPlan,
  type SymptomSpec,
} from "./maintainer-api";
import DraftBar from "./draft-bar";
import HarnessPanel from "./harness-panel";
import ImpactPanel from "./impact-panel";
import { overviewText } from "./overview-text";
import RuleDescription from "./rule-description";
import PublishDialog from "./publish-dialog";
import SaveAsTemplateModal from "./save-as-template-modal";
import SheetHeader from "./sheet-header";
import SheetTop from "./ui/sheet-top";
import ResponseWorkspace, { firstResponseLevel } from "./response-workspace";
import SymptomRuleSections, { changedLevels } from "./symptom-rule-sections";
import {
  FieldsPanel,
  PreviewPanel,
  ReviewPanel,
  originLabel,
} from "./symptom-side-panels";
import { pendingError } from "./pending-error";
import {
  isTemplateScope,
  PLATFORM_TEMPLATES,
  useSymptomScope,
  type SymptomScope,
} from "./symptom-scope";
import { useSymptomDraft } from "./use-symptom-draft";
import { changedPaths } from "./ui/changed";
import VersionBanner from "./version-banner";
import VersionsDrawer from "./versions-drawer";
import WorkspaceTabs, {
  WORKSPACE_PANEL_ID,
  workspaceTabId,
} from "./workspace-tabs";

/** The name a copy starts with, as in the prototype: "Exceso de velocidad (variante)". */
function variantName(name: string, d: I18nRecord) {
  return tr("variantName", d, { name });
}

/** Who may edit the sheet: platform owners for a template, Control Tower maintainers for a symptom. */
function useSheetAccess(scope: SymptomScope) {
  const template = isTemplateScope(scope);
  const { canMaintain } = useControlTowerAccess();
  const { isPlatformOwner } = useIsPlatformOwner();
  return {
    template,
    isPlatformOwner,
    canWrite: template ? isPlatformOwner : canMaintain,
  };
}

/** Amber marks: what the draft changes against the published version; none before publishing. */
function changeMarks(
  spec: SymptomSpec | null | undefined,
  published: SymptomSpec | null | undefined,
  plan: PublishPlan | null | undefined,
  planIsCurrent: boolean
): Set<string> {
  if (!published || !spec) return new Set<string>();
  const paths = changedPaths(spec, published);
  // Conditions in another order are no change for the publish plan, so no mark either.
  if (
    planIsCurrent &&
    plan &&
    !plan.changes.some((c) => c.section === "activation")
  ) {
    paths.delete("activation");
  }
  // Levels are compared by ICU, ignoring the rule kept by one that no longer applies.
  if (changedLevels(spec, published).size === 0) {
    for (const p of paths)
      if (p === "levels" || p.startsWith("levels.")) paths.delete(p);
  }
  return paths;
}

/** The scrolling sheet; opening an old version scrolls it to the top. */
const SHEET_ID = "symptom-sheet";

type Pending =
  | { kind: "rollback"; version: string }
  | { kind: "fork"; version: string }
  | null;

/**
 * The symptom page: its rules as editable CEL, checked and previewed by the
 * server as you type. Under the platform scope it edits a template, which has
 * no state, stats or Harness.
 */
export default function SymptomDetail({
  id,
  dict,
  rootDict,
  lang,
  harnessEnabled = false,
}: Readonly<{
  id: string;
  dict: I18nRecord;
  rootDict: I18nRecord;
  lang: string;
  /** The Harness chat is mounted, so requests can be sent to it. */
  harnessEnabled?: boolean;
}>) {
  const d = dict?.symptomCatalog as I18nRecord;
  const router = useRouter();
  const { switchOrg } = useOrgScopes();
  const scope = useSymptomScope();
  const { template, isPlatformOwner, canWrite } = useSheetAccess(scope);
  const {
    detail,
    error,
    spec,
    update,
    report,
    preview,
    currentPreview,
    saving,
    saveError,
    external,
    discard,
    resync,
    showPublished,
    planIsCurrent,
  } = useSymptomDraft(id, canWrite);
  const { data: families, error: familiesError } = useSymptomFamilies();
  const { data: templates } = useSymptomTemplates(!template);
  const { data: plan, error: planError } = usePublishPlan(
    id,
    Boolean(canWrite && detail?.draft)
  );
  // An old version open read-only in place of the draft.
  const [viewing, setViewing] = useState<string | null>(null);
  const viewed = viewing
    ? detail?.versions.find((v) => v.version === viewing)
    : undefined;
  const shownSpec = viewed?.spec ?? spec;
  const published = detail?.current?.spec;
  const changed = useMemo(
    () =>
      viewed
        ? new Set<string>()
        : changeMarks(spec, published, plan, planIsCurrent),
    [viewed, published, spec, plan, planIsCurrent]
  );
  // The overview describes the version on screen, or the one in force; a draft would rewrite it on every edit.
  const overviewSpec = viewed?.spec ?? published ?? null;
  const overview = overviewSpec ? overviewText(overviewSpec) : "";
  const { data: source } = useDataSource(
    shownSpec?.source ?? detail?.definition.sourceKey ?? null
  );
  // "Respuesta" shows one level's response at a time; null is "Regla".
  const [responseIcu, setResponseIcu] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [text, setText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // After the banner renders: scrolling before it would be undone by scroll anchoring.
  useEffect(() => {
    if (viewing) document.getElementById(SHEET_ID)?.scrollTo({ top: 0 });
  }, [viewing]);

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
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  // The dialog stays open on failure and shows why; its buttons are off while the request runs.
  const confirmPending = async () => {
    if (!pending || confirming) return;
    setConfirming(true);
    setDialogError(null);
    try {
      if (pending.kind === "rollback") {
        await rollbackTo(id, pending.version, text.trim() || undefined, scope);
        await refreshSymptoms(undefined, scope);
        await resync();
        setViewing(null);
      } else {
        const created = await forkSymptom(
          id,
          { version: pending.version, key: keyFrom(text), name: text.trim() },
          scope
        );
        await refreshSymptoms(undefined, scope);
        router.push(`/${lang}${scope.pages}/${created.definition.id}`);
      }
      setPending(null);
    } catch (e) {
      setDialogError(pendingError(e, pending.kind, d));
    } finally {
      setConfirming(false);
    }
  };

  const closePending = () => {
    if (confirming) return;
    setPending(null);
    setDialogError(null);
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
      <div
        id={SHEET_ID}
        className="min-h-0 flex-1 overflow-y-auto dark:bg-gray-900"
      >
        <SheetTop>
          {def && (
            <SheetHeader
              def={def}
              spec={shownSpec}
              canWrite={canWrite && !viewed}
              families={families}
              familiesMissing={familiesListMissing(familiesError)}
              templates={templates}
              forkedFrom={detail?.forkedFrom ?? null}
              backHref={`/${lang}${scope.pages}`}
              lang={lang}
              d={d}
              rootDict={rootDict}
              stateless={template}
              onChange={update}
              onSaveAsTemplate={
                !template && isPlatformOwner
                  ? () => setSavingTemplate(true)
                  : undefined
              }
              onHistory={() => setHistoryOpen(true)}
              onDuplicate={() => {
                if (!def.currentVersion) return;
                setText(variantName(def.name, d));
                setPending({ kind: "fork", version: def.currentVersion });
              }}
              actions={
                canWrite &&
                !viewed && (
                  <>
                    {actionError && (
                      <span
                        role="alert"
                        className="max-w-56 break-words text-right text-xs text-red-600 dark:text-red-400"
                      >
                        {actionError}
                      </span>
                    )}
                    {detail?.draft && (
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
                  </>
                )
              }
            />
          )}
        </SheetTop>
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pt-3 pb-10">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {tr("loadFailed", d)}
            </p>
          )}
          {external && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
            >
              {tr("draftChangedElsewhere", d)}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => void resync()}
              >
                {tr("draftReload", d)}
              </button>
            </div>
          )}

          {viewed?.version && (
            <VersionBanner
              id={id}
              version={viewed.version}
              current={def?.currentVersion ?? null}
              canWrite={canWrite}
              d={d}
              onRevert={() => {
                setText("");
                setPending({
                  kind: "rollback",
                  version: viewed.version as string,
                });
              }}
              onDuplicate={() => {
                setText(variantName(def?.name ?? "", d));
                setPending({ kind: "fork", version: viewed.version as string });
              }}
              onBack={() => setViewing(null)}
            />
          )}

          {shownSpec && detail && (
            <WorkspaceTabs
              response={responseIcu !== null}
              d={d}
              onRule={() => setResponseIcu(null)}
              onResponse={() =>
                setResponseIcu(
                  (icu) =>
                    icu ??
                    firstResponseLevel(
                      shownSpec,
                      viewed ? undefined : report?.findings
                    )
                )
              }
            />
          )}

          <div
            role="tabpanel"
            id={WORKSPACE_PANEL_ID}
            aria-labelledby={workspaceTabId(responseIcu !== null)}
            className="flex flex-col gap-4"
          >
            {responseIcu !== null && shownSpec && detail && (
              <ResponseWorkspace
                spec={shownSpec}
                symptom={
                  template || !def
                    ? undefined
                    : { key: def.key, name: def.name }
                }
                changedLevels={
                  viewed
                    ? new Set<number>()
                    : changedLevels(shownSpec, published)
                }
                preview={viewed ? undefined : (currentPreview ?? undefined)}
                findings={viewed ? undefined : report?.findings}
                readOnly={!canWrite || Boolean(viewed)}
                icu={responseIcu}
                d={d}
                onIcu={setResponseIcu}
                onChange={update}
              />
            )}

            {responseIcu === null && overviewSpec && overview && (
              <RuleDescription
                section="overview"
                rule={overview}
                sourceKey={overviewSpec.source ?? def?.sourceKey ?? null}
                d={d}
              />
            )}

            {responseIcu === null && shownSpec && detail && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <SymptomRuleSections
                    spec={shownSpec}
                    changed={changed}
                    published={viewed ? null : published}
                    preview={viewed ? undefined : (currentPreview ?? undefined)}
                    fields={source?.fields ?? []}
                    sourceFields={fields}
                    findings={viewed ? undefined : report?.findings}
                    readOnly={!canWrite || Boolean(viewed)}
                    d={d}
                    onChange={update}
                    onConfigureResponse={setResponseIcu}
                  />
                </div>
                <div className="flex flex-col gap-4">
                  {!viewed && (
                    <>
                      <ReviewPanel report={report} d={d} />
                      <PreviewPanel
                        preview={preview}
                        d={d}
                        rootDict={rootDict}
                      />
                      {!template && harnessEnabled && canWrite && def && (
                        <HarnessPanel id={id} name={def.name} d={d} />
                      )}
                      {!template && (
                        <ImpactPanel
                          definitionId={id}
                          spec={spec ?? shownSpec}
                          published={published}
                          lang={lang}
                          d={d}
                        />
                      )}
                    </>
                  )}
                  <FieldsPanel source={source} d={d} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <VersionsDrawer
        show={historyOpen}
        versions={detail?.versions ?? []}
        changes={detail?.versionChanges ?? {}}
        current={def?.currentVersion ?? null}
        canWrite={canWrite}
        d={d}
        onClose={() => setHistoryOpen(false)}
        onView={(version) => {
          setHistoryOpen(false);
          setViewing(version);
        }}
        onRollback={(version) => {
          setHistoryOpen(false);
          setText("");
          setPending({ kind: "rollback", version });
        }}
        onFork={(version) => {
          setHistoryOpen(false);
          setText(variantName(def?.name ?? "", d));
          setPending({ kind: "fork", version });
        }}
      />

      <PublishDialog
        id={id}
        name={def?.name ?? ""}
        current={def?.currentVersion ?? null}
        open={publishing}
        d={d}
        onClose={() => setPublishing(false)}
        onPublished={(version) => {
          setPublishing(false);
          void refreshSymptoms(undefined, scope);
          void showPublished(version);
        }}
      />

      {def && !template && isPlatformOwner && (
        <SaveAsTemplateModal
          open={savingTemplate}
          def={def}
          version={viewed?.version ?? def.currentVersion}
          d={d}
          onClose={() => setSavingTemplate(false)}
          onSaved={(saved) => {
            setSavingTemplate(false);
            // The template lives in the platform scope: switch to it and open the template there.
            // location.assign does not add the base path the way router.push does.
            switchOrg(
              PLATFORM_SCOPE_SLUG,
              `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${lang}${PLATFORM_TEMPLATES.pages}/${saved.definition.id}`
            ).catch((error: unknown) =>
              setActionError(
                error instanceof Error ? error.message : String(error)
              )
            );
          }}
        />
      )}

      <PendingDialog
        pending={pending}
        text={text}
        confirming={confirming}
        error={dialogError}
        d={d}
        onText={setText}
        onClose={closePending}
        onConfirm={() => void confirmPending()}
      />
    </div>
  );
}

/** Asks for a copy's name, or a rollback's reason, before either runs. */
function PendingDialog({
  pending,
  text,
  confirming,
  error,
  d,
  onText,
  onClose,
  onConfirm,
}: Readonly<{
  pending: Pending;
  text: string;
  confirming: boolean;
  error: string | null;
  d: I18nRecord;
  onText: (text: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}>) {
  return (
    <Modal show={pending !== null} size="md" onClose={onClose}>
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
          onChange={(e) => onText(e.target.value)}
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {pending?.kind === "fork"
            ? tr("duplicateHint", d, { version: pending.version })
            : tr("restoreHint", d)}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" disabled={confirming} onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button
          disabled={confirming || (pending?.kind === "fork" && !text.trim())}
          onClick={onConfirm}
        >
          {pending?.kind === "fork" ? tr("duplicate", d) : tr("restore", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
