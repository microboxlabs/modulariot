"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { useRef } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SCRIPT_VARIABLES, scriptParts } from "./script-fill";

/** Why a variable shows unfilled in the preview. */
function missingText(known: boolean, hasSample: boolean, d: I18nRecord) {
  if (!known) return tr("scriptUnknown", d);
  return hasSample ? tr("scriptMissing", d) : tr("scriptNoSampleValue", d);
}

/**
 * A step's script ("Guion"): edit it, insert variables, and read it as the
 * operator will, filled from one of the source's samples.
 */
export default function ScriptModal({
  open,
  step,
  script,
  sample,
  readOnly,
  d,
  onChange,
  onClose,
}: Readonly<{
  open: boolean;
  /** The step's number, from 1. */
  step: number;
  script: string;
  sample: Record<string, unknown> | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (script: string) => void;
  onClose: () => void;
}>) {
  const box = useRef<HTMLTextAreaElement>(null);

  const insert = (variable: string) => {
    const text = `{{${variable}}}`;
    const el = box.current;
    const at = el?.selectionStart ?? script.length;
    const end = el?.selectionEnd ?? at;
    onChange(script.slice(0, at) + text + script.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + text.length, at + text.length);
    });
  };

  return (
    <Modal show={open} size="lg" onClose={onClose}>
      <ModalHeader>{tr("scriptTitle", d, { n: String(step) })}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-gray-500">{tr("scriptVariables", d)}</span>
              {SCRIPT_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rounded border border-gray-300 px-1.5 py-0.5 font-mono hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  // Keep the caret in the script: a focused chip would take the next keystroke.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(v)}
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={box}
            aria-label={tr("stepScript", d)}
            rows={4}
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            disabled={readOnly}
            placeholder={tr("stepScriptPlaceholder", d, {
              vars: SCRIPT_VARIABLES.map((v) => `{{${v}}}`).join(" "),
            })}
            value={script}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {sample ? tr("scriptPreview", d) : tr("scriptNoSample", d)}
            </span>
            <p className="whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-900/50 dark:text-gray-100">
              {script.trim()
                ? scriptParts(script, sample).map((part, i) => {
                    const key = `part-${i}`;
                    if ("text" in part)
                      return <span key={key}>{part.text}</span>;
                    return part.value === null ? (
                      <mark
                        key={key}
                        title={missingText(part.known, sample !== undefined, d)}
                        className="rounded bg-amber-100 px-0.5 dark:bg-amber-900/40 dark:text-amber-200"
                      >
                        {`{{${part.variable}}}`}
                      </mark>
                    ) : (
                      <b key={key}>{part.value}</b>
                    );
                  })
                : tr("scriptEmpty", d)}
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" onClick={onClose}>
          {tr("close", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
