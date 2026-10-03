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
import { overviewText } from "./overview-text";
import RuleDescription from "./rule-description";
import PublishDialog from "./publish-dialog";
import SheetHeader from "./sheet-header";
import SymptomRuleSections from "./symptom-rule-sections";
import {
  FieldsPanel,
  PreviewPanel,
  ReviewPanel,
  originLabel,
} from "./symptom-side-panels";
import { pendingError } from "./pending-error";
import { useSymptomDraft } from "./use-symptom-draft";
import { changedPaths } from "./ui/changed";
import VersionBanner from "./version-banner";
import VersionsDrawer from "./versions-drawer";

/** The name a copy starts with, as in the prototype: "Exceso de velocidad (variante)". */
function variantName(name: string, d: I18nRecord) {
  return tr("variantName", d, { name });
}

/** The scrolling sheet; opening an old version scrolls it to the top. */
const SHEET_ID = "symptom-sheet";

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
    currentPreview,
    saving,
    saveError,
    discard,
    resync,
    planIsCurrent,
  } = useSymptomDraft(id, canWrite);
  const { data: families } = useSymptomFamilies();
  const { data: templates } = useSymptomTemplates(true);
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
  // Amber marks: what the spec on screen changes against the published version; none for an old version or before publishing.
  const published = detail?.current?.spec;
  const changed = useMemo(() => {
    if (viewed || !published || !spec) return new Set<string>();
    const paths = changedPaths(spec, published);
    // Conditions in another order are no change for the publish plan, so no mark either.
    const reordered =
      planIsCurrent &&
      plan &&
      !plan.changes.some((c) => c.section === "activation");
    if (reordered) paths.delete("activation");
    return paths;
  }, [viewed, published, spec, plan, planIsCurrent]);
  // The overview describes the version on screen, or the one in force; a draft would rewrite it on every edit.
  const overviewSpec = viewed?.spec ?? published ?? null;
  const overview = overviewSpec ? overviewText(overviewSpec) : "";
  const { data: source } = useDataSource(
    shownSpec?.source ?? detail?.definition.sourceKey ?? null
  );
  const [publishing, setPublishing] = useState(false);
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
      await refreshSymptoms();
      await resync();
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
        await rollbackTo(id, pending.version, text.trim() || undefined);
        await refreshSymptoms();
        await resync();
        setViewing(null);
      } else {
        const created = await forkSymptom(id, {
          version: pending.version,
          key: keyFrom(text),
          name: text.trim(),
        });
        await refreshSymptoms();
        router.push(
          `/${lang}/users/settings/symptoms/${created.definition.id}`
        );
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
        className="mx-auto flex w-full max-w-screen-2xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-10 dark:bg-gray-900"
      >
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("loadFailed", d)}
          </p>
        )}
        {def && (
          <SheetHeader
            def={def}
            spec={shownSpec}
            canWrite={canWrite && !viewed}
            families={families}
            templates={templates}
            forkedFrom={detail?.forkedFrom ?? null}
            backHref={`/${lang}/users/settings/symptoms`}
            lang={lang}
            d={d}
            rootDict={rootDict}
            onChange={update}
            onHistory={() => setHistoryOpen(true)}
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

        {overviewSpec && overview && (
          <RuleDescription
            section="overview"
            rule={overview}
            sourceKey={overviewSpec.source ?? def?.sourceKey ?? null}
            d={d}
          />
        )}

        {shownSpec && detail && (
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
                connections={connections}
                lang={lang}
                onChange={update}
              />
            </div>
            <div className="flex flex-col gap-4">
              {!viewed && (
                <>
                  <ReviewPanel report={report} d={d} />
                  <PreviewPanel preview={preview} d={d} rootDict={rootDict} />
                </>
              )}
              <FieldsPanel source={source} d={d} />
            </div>
          </div>
        )}
        {canWrite && detail?.draft && !viewed && (
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
        onPublished={() => {
          setPublishing(false);
          void refreshSymptoms();
          void resync();
        }}
      />

      <Modal show={pending !== null} size="md" onClose={closePending}>
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
          {dialogError && (
            <p
              role="alert"
              className="mt-2 text-sm text-red-600 dark:text-red-400"
            >
              {dialogError}
            </p>
          )}
        </ModalBody>
        <ModalFooter className="justify-end">
          <Button
            color="alternative"
            disabled={confirming}
            onClick={closePending}
          >
            {tr("cancel", d)}
          </Button>
          <Button
            disabled={confirming || (pending?.kind === "fork" && !text.trim())}
            onClick={() => void confirmPending()}
          >
            {pending?.kind === "fork" ? tr("duplicate", d) : tr("restore", d)}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
