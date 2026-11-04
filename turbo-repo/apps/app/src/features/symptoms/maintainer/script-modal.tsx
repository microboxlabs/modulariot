"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { useMemo, useRef } from "react";
import { TemplateVariablesPanel } from "@/features/conversations/template-editor-parts";
import TemplateTextField, {
  type Inserter,
} from "@/features/conversations/template-text-field";
import type { EventField } from "@/features/conversations/conversations-types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SCRIPT_VARIABLES, scriptParts, scriptValue } from "./script-fill";

/** Why a variable shows unfilled in the preview. */
function missingText(known: boolean, hasSample: boolean, d: I18nRecord) {
  if (!known) return tr("scriptUnknown", d);
  return hasSample ? tr("scriptMissing", d) : tr("scriptNoSampleValue", d);
}

/** The variables the operator's script can use, named as the template editor names an event's fields. */
function scriptFields(d: I18nRecord): EventField[] {
  return SCRIPT_VARIABLES.map((name) => ({
    name,
    type: "string",
    label: trDynamic(`scriptVar.${name}`, d),
    description: trDynamic(`scriptVarHint.${name}`, d),
  }));
}

function ScriptPreview({
  script,
  sample,
  d,
}: Readonly<{
  script: string;
  sample: Record<string, unknown> | undefined;
  d: I18nRecord;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {sample ? tr("scriptPreview", d) : tr("scriptNoSample", d)}
      </span>
      <p className="whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-900/50 dark:text-gray-100">
        {script.trim()
          ? scriptParts(script, sample).map((part, i) => {
              const key = `part-${i}`;
              if ("text" in part) return <span key={key}>{part.text}</span>;
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
  );
}

/**
 * A step's script ("Guion"), laid out like a communication template: the text
 * field with its variable menu and `{{` completion, the variables panel beside
 * it with each one's example, and the script as the operator will read it,
 * filled from one of the source's samples.
 */
export default function ScriptModal({
  open,
  step,
  script,
  sample,
  readOnly,
  d,
  templateDict,
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
  /** The Comunicaciones texts the template field and the variables panel read. */
  templateDict: I18nRecord;
  onChange: (script: string) => void;
  onClose: () => void;
}>) {
  const fields = useMemo(() => scriptFields(d), [d]);
  const known = useMemo(() => new Set<string>(SCRIPT_VARIABLES), []);
  const examples = useMemo(
    () =>
      Object.fromEntries(
        SCRIPT_VARIABLES.map((v) => [v, scriptValue(v, sample) ?? ""])
      ),
    [sample]
  );
  // The panel inserts where the field's cursor last was.
  const inserter = useRef<Inserter | null>(null);
  const focus = (i: Inserter) => {
    inserter.current = i;
    return () => {
      if (inserter.current === i) inserter.current = null;
    };
  };
  const insert = (name: string) => {
    const text = `{{${name}}}`;
    if (inserter.current) inserter.current(text);
    else onChange(script + text);
  };

  return (
    <Modal show={open} size="4xl" onClose={onClose}>
      <ModalHeader>{tr("scriptTitle", d, { n: String(step) })}</ModalHeader>
      <ModalBody>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <TemplateTextField
              label={tr("stepScript", d)}
              value={script}
              onChange={onChange}
              variables={fields}
              known={known}
              d={templateDict}
              readOnly={readOnly}
              rows={6}
              placeholder={tr("stepScriptPlaceholder", d, {
                vars: SCRIPT_VARIABLES.map((v) => `{{${v}}}`).join(" "),
              })}
              hint={tr("scriptHint", d)}
              onFocusField={focus}
            />
            <ScriptPreview script={script} sample={sample} d={d} />
          </div>
          <TemplateVariablesPanel
            variables={fields}
            examples={examples}
            eventPicked
            readOnly={readOnly}
            d={templateDict}
            onInsert={insert}
          />
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
