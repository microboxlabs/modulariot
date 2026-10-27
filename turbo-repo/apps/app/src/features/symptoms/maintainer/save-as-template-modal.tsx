"use client";

import { useEffect, useState } from "react";
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
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ControlTowerError } from "../control-tower/control-tower-api";
import {
  saveAsTemplate,
  useSymptomTemplates,
  type SymptomDefinition,
  type SymptomDetail,
} from "./maintainer-api";

/** Why saving failed, in the page's language. */
export function saveAsTemplateError(e: unknown, d: I18nRecord): string {
  const status = e instanceof ControlTowerError ? e.status : null;
  if (status === 403) return tr("saveAsTemplateForbidden", d);
  if (status === 409) return tr("saveAsTemplateConflict", d);
  return tr("actionFailed", d);
}

/**
 * Guardar como plantilla (platform owners): the symptom's spec becomes the
 * draft of a new template, or of an existing one. Organizations see it once a
 * platform owner publishes the template.
 */
export default function SaveAsTemplateModal({
  open,
  def,
  version,
  d,
  onClose,
  onSaved,
}: Readonly<{
  open: boolean;
  def: SymptomDefinition;
  /** The version to copy; null copies the draft. */
  version: string | null;
  d: I18nRecord;
  onClose: () => void;
  onSaved: (template: SymptomDetail) => void;
}>) {
  const { data: templates } = useSymptomTemplates(open);
  const [target, setTarget] = useState("");
  const [name, setName] = useState(def.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(def.name);
    setError(null);
    setTarget("");
  }, [open, def.name]);

  // A symptom copied from a template saves back to it unless another is picked.
  const known = templates?.some((t) => t.key === def.templateKey);
  useEffect(() => {
    if (open && known && def.templateKey) setTarget(def.templateKey);
  }, [open, known, def.templateKey]);

  const replacing = templates?.find((t) => t.key === target);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await saveAsTemplate(def.id, {
        version,
        templateKey: target || null,
        name: name.trim() || null,
      });
      onSaved(saved);
    } catch (e) {
      setError(saveAsTemplateError(e, d));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={open} size="md" onClose={busy ? undefined : onClose}>
      <ModalHeader>{tr("saveAsTemplate", d)}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="template-target">{tr("templateTarget", d)}</Label>
            <Select
              id="template-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">
                {tr("templateTargetNew", d, { key: def.key })}
              </option>
              {(templates ?? []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                  {t.version
                    ? ` · v${t.version}`
                    : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="template-name">{tr("name", d)}</Label>
            <TextInput
              id="template-name"
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {replacing
              ? tr("saveAsTemplateReplaceHint", d, {
                  name: replacing.name,
                  version: version ?? tr("unpublished", d),
                })
              : tr("saveAsTemplateNewHint", d, {
                  version: version ?? tr("unpublished", d),
                })}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" disabled={busy} onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button disabled={busy} onClick={() => void submit()}>
          {tr("saveAsTemplate", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
