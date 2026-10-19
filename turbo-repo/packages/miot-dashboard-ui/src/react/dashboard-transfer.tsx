"use client";
import { useEffect, useId, useRef, useState } from "react";
export interface DashboardTransferProps {
  readonly editable?: boolean;
  /** Called by an explicit export action; the host chooses filename and download mechanism. */
  readonly onExport: () => void;
  /** Import must validate the shared document contract and enforce current permissions. */
  readonly onImport: (json: string) => { success: boolean };
  readonly labels: {
    export: string;
    file: string;
    json: string;
    replace: string;
    hint: string;
    tooLarge: string;
    invalid: string;
    success: string;
  };
  /** Defaults to the server's 1 MiB document body limit. */
  readonly maxImportBytes?: number;
}
/** File/text transfer UI. Imports affect the host draft; persistence stays explicit. */
export function DashboardTransfer({
  editable = false,
  onExport,
  onImport,
  labels,
  maxImportBytes = 1024 * 1024,
}: DashboardTransferProps) {
  const id = useId();
  const [json, setJson] = useState("");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const permission = useRef(editable);
  permission.current = editable;
  if (!Number.isSafeInteger(maxImportBytes) || maxImportBytes < 1)
    throw new TypeError("Invalid import limit");
  async function readFile(file: File | undefined) {
    const current = ++generation.current;
    setStatus(undefined);
    setError(undefined);
    setJson("");
    setReading(false);
    if (!file) return;
    if (file.size > maxImportBytes) {
      setError(labels.tooLarge);
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (current === generation.current && permission.current) setJson(text);
    } catch {
      if (current === generation.current) setError(labels.invalid);
    } finally {
      if (current === generation.current) setReading(false);
    }
  }
  function edit(text: string) {
    generation.current++;
    setReading(false);
    setJson(text);
    setStatus(undefined);
    setError(undefined);
  }
  function replace() {
    if (!editable || reading) return;
    setStatus(undefined);
    if (new TextEncoder().encode(json).byteLength > maxImportBytes) {
      setError(labels.tooLarge);
      return;
    }
    if (!onImport(json).success) {
      setError(labels.invalid);
      return;
    }
    setError(undefined);
    setStatus(labels.success);
  }
  return (
    <section className="miot-general-settings">
      <button type="button" onClick={onExport}>
        {labels.export}
      </button>
      {editable && (
        <fieldset disabled={reading}>
          <p id={`${id}-hint`}>{labels.hint}</p>
          <label htmlFor={`${id}-file`}>{labels.file}</label>
          <input
            id={`${id}-file`}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void readFile(event.target.files?.[0]);
            }}
          />
          <label htmlFor={`${id}-json`}>{labels.json}</label>
          <textarea
            id={`${id}-json`}
            rows={6}
            maxLength={maxImportBytes}
            value={json}
            aria-describedby={`${id}-hint`}
            onChange={(event) => edit(event.target.value)}
          />
          <button type="button" disabled={!json} onClick={replace}>
            {labels.replace}
          </button>
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
      {status && <output>{status}</output>}
    </section>
  );
}
