"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Spinner } from "flowbite-react";
import { useSWRConfig } from "swr";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useMyAccess } from "@/features/settings-admin/team/team-api";
import {
  ASSET_KINDS,
  DOCUMENT_KEYS,
  assetPath,
  changedValues,
  updateAsset,
  useFleetAsset,
  type AssetDetail,
  type AssetField,
} from "../fleet-api";
import { errorMessage } from "./fleet-page";
import {
  PANEL,
  PageHeader,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SourceTag,
} from "./fleet-ui";

const EDIT = "fleet:assets.edit";
const IDENTIFICATION = ["label", "kind", "brandModel", "year", "vin", "base"];
const RELATIONS = ["carrier", "usualTrailer", "usualDriver"];
const INPUT =
  "block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400";

interface AssetEditPageProps {
  readonly assetId: string;
  /** `pages.fleet` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** The asset's manual values: what is set by hand wins until it is cleared. */
export function initialValues(asset: AssetDetail) {
  const fields: Record<string, string> = {};
  for (const f of asset.fields) {
    if (f.editable)
      fields[f.key] = f.source === "MANUAL" ? (f.value ?? "") : "";
  }
  const documents: Record<string, string> = {};
  for (const key of DOCUMENT_KEYS) {
    documents[key] =
      asset.documents.find((doc) => doc.key === key)?.expiresAt ?? "";
  }
  return { fields, documents };
}

/** Edit an asset's data and document dates. */
export default function AssetEditPage({
  assetId,
  dict,
  lang,
}: AssetEditPageProps) {
  const d = dict ?? {};
  const { access, accessError, can } = useMyAccess();
  const allowed = can(EDIT);
  const { data, error } = useFleetAsset(assetId, allowed);
  const loading = !accessError && (!access || (allowed && !data && !error));
  const failure = accessError ?? error;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
        {loading && <Spinner className="mx-auto" />}
        {!loading && failure && (
          <Alert color="gray">{errorMessage(failure, d)}</Alert>
        )}
        {!loading && !failure && !allowed && (
          <Alert color="gray">{tr("notAllowed", d)}</Alert>
        )}
        {data && allowed && (
          <EditForm key={data.id} asset={data} d={d} lang={lang} />
        )}
      </div>
    </div>
  );
}

function EditForm({
  asset,
  d,
  lang,
}: {
  readonly asset: AssetDetail;
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [initial] = useState(() => initialValues(asset));
  const [fields, setFields] = useState(initial.fields);
  const [documents, setDocuments] = useState(initial.documents);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const detailHref = `/${lang}/fleet/${encodeURIComponent(asset.id)}`;
  const byKey = new Map(asset.fields.map((f) => [f.key, f]));
  const gpsProvider = byKey.get("gpsProvider");
  const conflicts = asset.fields.filter(
    (f) => f.conflict && fields[f.key] === initial.fields[f.key]
  );

  const save = async () => {
    const update = {
      fields: changedValues(initial.fields, fields),
      documents: changedValues(initial.documents, documents),
    };
    if (
      Object.keys(update.fields).length === 0 &&
      Object.keys(update.documents).length === 0
    ) {
      setMessage(tr("edit.noChanges", d));
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateAsset(asset.id, update);
      await mutate(assetPath(asset.id), saved, { revalidate: false });
      await mutate(
        (key) =>
          typeof key === "string" && key.startsWith("/app/api/fleet/assets?"),
        undefined,
        { revalidate: true }
      );
      router.push(detailHref);
    } catch (e) {
      setMessage(
        tr("edit.saveFailed", d, {
          reason: e instanceof Error ? e.message : String(e),
        })
      );
      setSaving(false);
    }
  };

  const setField = (key: string, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PageHeader
        caption={`${tr("breadcrumb.fleet", d)} / ${asset.id} / ${tr("breadcrumb.edit", d)}`}
        title={tr("edit.title", d)}
        backHref={detailHref}
        backLabel={tr("actions.back", d)}
        actions={
          <>
            <Link className={SECONDARY_BUTTON} href={detailHref}>
              {tr("actions.cancel", d)}
            </Link>
            <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>
              {saving && <Spinner size="sm" />}
              {tr("actions.save", d)}
            </button>
          </>
        }
      />
      <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-400">
        {tr("edit.legend", d)}
      </p>
      {message && <Alert color="gray">{message}</Alert>}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <FieldGroup title={tr("edit.identification", d)}>
            {IDENTIFICATION.map((key) => {
              const f = byKey.get(key);
              return f ? (
                <FieldInput
                  key={key}
                  field={f}
                  value={fields[key] ?? ""}
                  onChange={(v) => setField(key, v)}
                  d={d}
                />
              ) : null;
            })}
          </FieldGroup>
          <FieldGroup title={tr("edit.relations", d)}>
            {RELATIONS.map((key) => {
              const f = byKey.get(key);
              return f ? (
                <FieldInput
                  key={key}
                  field={f}
                  value={fields[key] ?? ""}
                  onChange={(v) => setField(key, v)}
                  d={d}
                />
              ) : null;
            })}
            {gpsProvider && <ReadOnlyField field={gpsProvider} d={d} />}
          </FieldGroup>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          {conflicts.map((f) => (
            <section
              key={f.key}
              className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-5 dark:bg-amber-900/20"
            >
              <span className="text-xs font-medium tracking-wide text-amber-800 uppercase dark:text-amber-300">
                {tr("conflict.title", d)}
              </span>
              <p className="text-sm text-gray-900 dark:text-white">
                {tr("conflict.body", d, {
                  field: trDynamic(`fields.${f.key}`, d),
                  source: trDynamic(`sources.${f.integrationSource}`, d),
                  integration: displayValue(f.key, f.integrationValue, d),
                  manual: displayValue(f.key, f.value, d),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  onClick={() => setField(f.key, "")}
                >
                  {tr("conflict.useIntegration", d, {
                    value: displayValue(f.key, f.integrationValue, d),
                  })}
                </button>
              </div>
            </section>
          ))}
          <FieldGroup title={tr("edit.documents", d)} columns={1}>
            <p className="-mt-2 text-xs text-gray-600 dark:text-gray-400">
              {tr("edit.documentsHint", d)}
            </p>
            {DOCUMENT_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`doc-${key}`}
                  className="text-sm font-medium text-gray-900 dark:text-white"
                >
                  {trDynamic(`documents.${key}`, d)}
                </label>
                <input
                  id={`doc-${key}`}
                  type="date"
                  className={INPUT}
                  value={documents[key] ?? ""}
                  onChange={(e) =>
                    setDocuments((current) => ({
                      ...current,
                      [key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </FieldGroup>
        </aside>
      </div>
    </form>
  );
}

function FieldGroup({
  title,
  columns = 2,
  children,
}: {
  readonly title: string;
  readonly columns?: 1 | 2;
  readonly children: ReactNode;
}) {
  return (
    <section className={`${PANEL} p-5`}>
      <h2 className="mb-4 text-base font-medium text-gray-900 dark:text-white">
        {title}
      </h2>
      <div
        className={`grid grid-cols-1 gap-4 ${columns === 2 ? "md:grid-cols-2" : ""}`}
      >
        {children}
      </div>
    </section>
  );
}

/** The value as people read it: kinds through the dictionary, the rest as is. */
function displayValue(key: string, value: string | null, d: I18nRecord) {
  if (value == null) return "—";
  return key === "kind" ? trDynamic(`kinds.${value}`, d) : value;
}

function SourceLine({
  field,
  editedNow,
  d,
}: {
  readonly field: AssetField;
  readonly editedNow: boolean;
  readonly d: I18nRecord;
}) {
  const source = editedNow ? "MANUAL" : field.source;
  let detail: string;
  if (source === "MANUAL") {
    detail = tr("sourceDetail.manual", d);
  } else if (field.integrationSource === "TRIP" && field.count != null) {
    detail = tr("sourceDetail.trips", d, {
      count: String(field.count),
      total: String(field.total ?? field.count),
    });
  } else if (field.reported) {
    detail = tr("sourceDetail.reported", d, { value: field.reported });
  } else if (field.integrationSource === "NONE") {
    detail = tr("sourceDetail.none", d);
  } else {
    detail = "";
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <SourceTag source={source} d={d} />
      {detail}
    </span>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  d,
}: {
  readonly field: AssetField;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly d: I18nRecord;
}) {
  const id = `field-${field.key}`;
  const placeholder = displayValue(field.key, field.integrationValue, d);
  const editedNow = value.trim() !== "";
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-900 dark:text-white"
      >
        {trDynamic(`fields.${field.key}`, d)}
      </label>
      {field.key === "kind" ? (
        <select
          id={id}
          className={INPUT}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {tr("edit.chooseKind", d)}
            {field.integrationValue ? ` (${placeholder})` : ""}
          </option>
          {ASSET_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {trDynamic(`kinds.${kind}`, d)}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={`${INPUT} ${field.key === "vin" || field.key === "usualTrailer" ? "font-mono" : ""}`}
          value={value}
          placeholder={placeholder === "—" ? "" : placeholder}
          inputMode={field.key === "year" ? "numeric" : undefined}
          maxLength={200}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <SourceLine field={field} editedNow={editedNow} d={d} />
    </div>
  );
}

function ReadOnlyField({
  field,
  d,
}: {
  readonly field: AssetField;
  readonly d: I18nRecord;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {trDynamic(`fields.${field.key}`, d)}
      </span>
      <span
        className={`${INPUT} flex items-center bg-gray-100 dark:bg-gray-700`}
      >
        {field.value ?? "—"}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <SourceTag source={field.source} d={d} />
        {tr("edit.readonly", d)}
        {field.reported
          ? ` · ${tr("sourceDetail.sender", d, { value: field.reported })}`
          : ""}
      </span>
    </div>
  );
}
