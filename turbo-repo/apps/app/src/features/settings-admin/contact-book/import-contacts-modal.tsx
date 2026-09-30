"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { HiOutlineDocumentText, HiOutlineUpload } from "react-icons/hi";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { ALL_CALL_METHODS } from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import { channelsToContact, emptyChannels, type ChannelsValue } from "./contact-form-fields";
import {
  IMPORT_COLUMNS,
  parseContactsCsv,
  splitBadgeNames,
  type ImportRow,
  type ImportRowStatus,
} from "./parse-contacts-csv";
import { makeContactId, type BookContact } from "./store";
import { ensureBadge } from "./taxonomy-store";

/** What the example table shows before a file is loaded. */
const EXAMPLE_ROWS: ImportRow["values"][] = [
  {
    name: "Rodrigo Seguel",
    description: "Programador de Microboxlabs",
    rut: "12.345.678-5",
    company: "Microboxlabs",
    position: "Programador",
    badges: "desarrollo|mintral|santiago",
    whatsapp: "+56 9 1234 5678",
    meet: "rodrigo@gmail.com",
  },
  {
    name: "Ana Pérez",
    description: "Supervisora de turno",
    rut: "9.876.543-3",
    company: "Mintral",
    position: "Supervisora",
    badges: "transportista|mintral",
    phone: "+56 9 8765 4321",
  },
];

const STATUS_KEYS: Record<ImportRowStatus, string> = {
  ok: "importStatusOk",
  missingName: "importStatusMissingName",
  invalidRut: "importStatusInvalidRut",
  duplicateRut: "importStatusDuplicateRut",
  duplicateInFile: "importStatusDuplicateInFile",
};

function statusTone(status: ImportRowStatus): string {
  if (status === "ok") return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300";
  return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsText(file);
  });
}

/** Builds a contact from an "ok" row, creating any badge that's new. */
function rowToContact(values: ImportRow["values"]): BookContact {
  const channels: ChannelsValue = emptyChannels();
  for (const m of ALL_CALL_METHODS) {
    const v = values[m];
    if (v) channels[m] = { enabled: true, value: v };
  }
  const position = values.position ?? "";
  return {
    id: makeContactId(),
    name: values.name ?? "",
    description: values.description,
    rut: values.rut,
    company: values.company,
    position: values.position,
    role: position || (values.description ?? ""),
    badgeIds: splitBadgeNames(values.badges).map((name) => ensureBadge(name).id),
    ...channelsToContact(channels),
  };
}

function DropZone({
  fileName,
  onFile,
  d,
}: Readonly<{ fileName: string; onFile: (file: File) => void; d: I18nRecord }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const tone = dragging
    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
    : "border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-gray-500";

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${tone}`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-300">
          {fileName ? <HiOutlineDocumentText className="h-6 w-6" /> : <HiOutlineUpload className="h-6 w-6" />}
        </span>
        <span className="text-base font-semibold text-gray-900 dark:text-white">
          {fileName || tr("importDropTitle", d)}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {fileName ? tr("importDropReplace", d) : tr("importDropHint", d)}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

function RowsTable({
  rows,
  showStatus,
  d,
}: Readonly<{ rows: readonly ImportRow["values"][]; showStatus?: readonly ImportRowStatus[]; d: I18nRecord }>) {
  const cell = "whitespace-nowrap px-3 py-2";
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            {showStatus && <th className={`${cell} text-left font-semibold text-gray-500`}>{tr("importColStatus", d)}</th>}
            {IMPORT_COLUMNS.map((c) => (
              <th key={c.field} className={`${cell} text-left font-semibold text-gray-500 dark:text-gray-400`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((values, i) => (
            <tr key={`${values.name ?? ""}-${i}`} className="border-t border-gray-100 dark:border-gray-700">
              {showStatus?.[i] && (
                <td className={cell}>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${statusTone(showStatus[i])}`}>
                    {trDynamic(STATUS_KEYS[showStatus[i]], d)}
                  </span>
                </td>
              )}
              {IMPORT_COLUMNS.map((c) => (
                <td key={c.field} className={`${cell} text-gray-700 dark:text-gray-300`}>
                  {values[c.field] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "Importar contactos": drop a CSV (fixed columns, see
 * `parse-contacts-csv.ts`), check the preview, import. Before a file is
 * loaded the table shows example rows of the expected layout. Rows with a
 * missing name, an invalid RUT or a RUT that already exists are skipped.
 * Closes by clicking outside, like the contact form.
 */
export default function ImportContactsModal({
  show,
  onClose,
  contacts,
  onImport,
  dict,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  contacts: readonly BookContact[];
  onImport: (added: BookContact[]) => void;
  /** `pages.userSettings` dictionary. */
  dict: I18nRecord;
}>) {
  const d = dict?.contactBook as I18nRecord;
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);

  useEffect(() => {
    if (show) {
      setFileName("");
      setRows(null);
    }
  }, [show]);

  const handleFile = (file: File) => {
    readFileText(file)
      .then((text) => {
        setFileName(file.name);
        setRows(parseContactsCsv(text, contacts));
      })
      .catch(() => ShowNotification({ type: "error", message: tr("importReadError", d) }));
  };

  const okRows = rows?.filter((r) => r.status === "ok") ?? [];

  const handleImport = () => {
    if (okRows.length === 0) return;
    onImport(okRows.map((r) => rowToContact(r.values)));
    ShowNotification({
      type: "success",
      message: tr("importDone", d, { count: String(okRows.length) }),
    });
    onClose();
  };

  return (
    <AbsoluteModal
      selected={show}
      setSelected={onClose}
      maxWidth="56rem"
      maxHeight="90vh"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tr("importTitle", d)}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr("importDescription", d)}</p>
        </div>
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
          <DropZone fileName={fileName} onFile={handleFile} d={d} />
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {rows ? tr("importPreviewTitle", d, { ok: String(okRows.length), total: String(rows.length) }) : tr("importExampleTitle", d)}
            </span>
            {rows ? (
              <RowsTable rows={rows.map((r) => r.values)} showStatus={rows.map((r) => r.status)} d={d} />
            ) : (
              <RowsTable rows={EXAMPLE_ROWS} d={d} />
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            disabled={okRows.length === 0}
            onClick={handleImport}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tr("importButton", d)}
          </button>
        </div>
      </div>
    </AbsoluteModal>
  );
}
