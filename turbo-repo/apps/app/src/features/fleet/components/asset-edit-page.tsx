"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Label,
  Select,
  Spinner,
  TextInput,
} from "flowbite-react";
import { HiOutlineExclamation } from "react-icons/hi";
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
  type FieldSource,
} from "../fleet-api";
import { errorMessage } from "./fleet-page";
import { CARD, CARD_TITLE, FleetHeader, SourceBadge } from "./fleet-ui";

const EDIT = "fleet:assets.edit";
const IDENTIFICATION = ["label", "kind", "brandModel", "year", "vin", "base"];
const RELATIONS = ["carrier", "usualTrailer", "usualDriver"];

interface AssetEditPageProps {
  readonly assetId: string;
  /** `pages.fleet` subtree. */
  readonly dict: I18nRecord;
  /** The whole dictionary, for the section header's filter bar. */
  readonly rootDict: I18nRecord;
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
  rootDict,
}: Readonly<AssetEditPageProps>) {
  const d = dict ?? {};
  const { access, accessError, can } = useMyAccess();
  const allowed = can(EDIT);
  const { data, error } = useFleetAsset(assetId, allowed);
  const loading = !accessError && (!access || (allowed && !data && !error));
  const failure = accessError ?? error;
  const fleetHref = `/${lang}/fleet`;
  const detailHref = `${fleetHref}/${encodeURIComponent(assetId)}`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <FleetHeader
        filterDict={rootDict}
        crumbs={[
          { label: tr("title", d), href: fleetHref },
          { label: assetId, href: detailHref },
          { label: tr("breadcrumb.edit", d) },
        ]}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        {loading && <Spinner className="mx-auto" />}
        {!loading && failure && (
          <Alert color="gray">{errorMessage(failure, d)}</Alert>
        )}
        {!loading && !failure && !allowed && (
          <Alert color="gray">{tr("notAllowed", d)}</Alert>
        )}
        {data && allowed && (
          <EditForm key={data.id} asset={data} d={d} detailHref={detailHref} />
        )}
      </div>
    </div>
  );
}

function EditForm({
  asset,
  d,
  detailHref,
}: Readonly<{ asset: AssetDetail; d: I18nRecord; detailHref: string }>) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [initial] = useState(() => initialValues(asset));
  const [fields, setFields] = useState(initial.fields);
  const [documents, setDocuments] = useState(initial.documents);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const byKey = new Map(asset.fields.map((f) => [f.key, f]));
  const gpsProvider = byKey.get("gpsProvider");
  const conflicts = asset.fields.filter(
    (f) => f.conflict && fields[f.key] === initial.fields[f.key]
  );

  const setField = (key: string, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));
  const setDocument = (key: string, value: string) =>
    setDocuments((current) => ({ ...current, [key]: value }));

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

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr("edit.title", d)} ·{" "}
            <span className="font-mono">{asset.id}</span>
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {tr("edit.legend", d)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button as={Link} href={detailHref} color="light" size="sm">
            {tr("actions.cancel", d)}
          </Button>
          <Button type="submit" color="blue" size="sm" disabled={saving}>
            {saving && <Spinner size="sm" className="mr-2" />}
            {tr("actions.save", d)}
          </Button>
        </div>
      </div>
      {message && <Alert color="gray">{message}</Alert>}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <FieldGroup title={tr("edit.identification", d)}>
            {IDENTIFICATION.map((key) => (
              <OptionalField
                key={key}
                field={byKey.get(key)}
                value={fields[key] ?? ""}
                onChange={setField}
                d={d}
              />
            ))}
          </FieldGroup>
          <FieldGroup title={tr("edit.relations", d)}>
            {RELATIONS.map((key) => (
              <OptionalField
                key={key}
                field={byKey.get(key)}
                value={fields[key] ?? ""}
                onChange={setField}
                d={d}
              />
            ))}
            {gpsProvider && <ReadOnlyField field={gpsProvider} d={d} />}
          </FieldGroup>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          {conflicts.map((f) => (
            <ConflictAlert
              key={f.key}
              field={f}
              d={d}
              onUseIntegration={() => setField(f.key, "")}
            />
          ))}
          <FieldGroup title={tr("edit.documents", d)} columns={1}>
            <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">
              {tr("edit.documentsHint", d)}
            </p>
            {DOCUMENT_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`doc-${key}`}>
                  {trDynamic(`documents.${key}`, d)}
                </Label>
                <TextInput
                  id={`doc-${key}`}
                  type="date"
                  sizing="sm"
                  value={documents[key] ?? ""}
                  onChange={(e) => setDocument(key, e.target.value)}
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
}: Readonly<{ title: string; columns?: 1 | 2; children: ReactNode }>) {
  const grid = columns === 2 ? "md:grid-cols-2" : "";
  return (
    <section className={`${CARD} p-5`}>
      <h3 className={`${CARD_TITLE} mb-4`}>{title}</h3>
      <div className={`grid grid-cols-1 gap-4 ${grid}`}>{children}</div>
    </section>
  );
}

/** The value as people read it: kinds through the dictionary, the rest as is. */
function displayValue(key: string, value: string | null, d: I18nRecord) {
  if (value == null) return "—";
  return key === "kind" ? trDynamic(`kinds.${value}`, d) : value;
}

function ConflictAlert({
  field,
  d,
  onUseIntegration,
}: Readonly<{
  field: AssetField;
  d: I18nRecord;
  onUseIntegration: () => void;
}>) {
  const integration = displayValue(field.key, field.integrationValue, d);
  return (
    <Alert color="warning" icon={HiOutlineExclamation}>
      <p className="font-medium">{tr("conflict.title", d)}</p>
      <p className="mt-1">
        {tr("conflict.body", d, {
          field: trDynamic(`fields.${field.key}`, d),
          source: trDynamic(`sources.${field.integrationSource}`, d),
          integration,
          manual: displayValue(field.key, field.value, d),
        })}
      </p>
      <Button
        size="xs"
        color="blue"
        className="mt-3"
        onClick={onUseIntegration}
      >
        {tr("conflict.useIntegration", d, { value: integration })}
      </Button>
    </Alert>
  );
}

function sourceDetail(field: AssetField, source: FieldSource, d: I18nRecord) {
  if (source === "MANUAL") return tr("sourceDetail.manual", d);
  if (field.integrationSource === "TRIP" && field.count != null) {
    return tr("sourceDetail.trips", d, {
      count: String(field.count),
      total: String(field.total ?? field.count),
    });
  }
  if (field.reported) {
    return tr("sourceDetail.reported", d, { value: field.reported });
  }
  if (field.integrationSource === "NONE") return tr("sourceDetail.none", d);
  return "";
}

function SourceLine({
  field,
  editedNow,
  d,
}: Readonly<{ field: AssetField; editedNow: boolean; d: I18nRecord }>) {
  const source: FieldSource = editedNow ? "MANUAL" : field.source;
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <SourceBadge source={source} d={d} />
      {sourceDetail(field, source, d)}
    </span>
  );
}

function OptionalField({
  field,
  value,
  onChange,
  d,
}: Readonly<{
  field: AssetField | undefined;
  value: string;
  onChange: (key: string, value: string) => void;
  d: I18nRecord;
}>) {
  if (!field) return null;
  return <FieldInput field={field} value={value} onChange={onChange} d={d} />;
}

function FieldInput({
  field,
  value,
  onChange,
  d,
}: Readonly<{
  field: AssetField;
  value: string;
  onChange: (key: string, value: string) => void;
  d: I18nRecord;
}>) {
  const id = `field-${field.key}`;
  const placeholder = displayValue(field.key, field.integrationValue, d);
  const mono = field.key === "vin" || field.key === "usualTrailer";
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{trDynamic(`fields.${field.key}`, d)}</Label>
      {field.key === "kind" ? (
        <Select
          id={id}
          sizing="sm"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
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
        </Select>
      ) : (
        <TextInput
          id={id}
          sizing="sm"
          className={mono ? "font-mono" : undefined}
          value={value}
          placeholder={placeholder === "—" ? "" : placeholder}
          inputMode={field.key === "year" ? "numeric" : undefined}
          maxLength={200}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
      <SourceLine field={field} editedNow={value.trim() !== ""} d={d} />
    </div>
  );
}

function ReadOnlyField({
  field,
  d,
}: Readonly<{ field: AssetField; d: I18nRecord }>) {
  const sender = field.reported
    ? ` · ${tr("sourceDetail.sender", d, { value: field.reported })}`
    : "";
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="field-gpsProvider">
        {trDynamic(`fields.${field.key}`, d)}
      </Label>
      <TextInput
        id="field-gpsProvider"
        sizing="sm"
        value={field.value ?? "—"}
        disabled
        readOnly
      />
      <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <SourceBadge source={field.source} d={d} />
        {tr("edit.readonly", d)}
        {sender}
      </span>
    </div>
  );
}
