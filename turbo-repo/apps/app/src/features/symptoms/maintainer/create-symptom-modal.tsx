"use client";

import { useState } from "react";
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
import {
  createSymptom,
  refreshSymptoms,
  useDataSources,
  type SymptomDetail,
} from "./maintainer-api";

/** The API's rule for keys. */
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,94}$/;

/** `Exceso de velocidad` → `exceso-de-velocidad`, the way the API wants keys. */
export function keyFrom(name: string) {
  return name
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 95);
}

export default function CreateSymptomModal({
  open,
  d,
  onClose,
  onCreated,
}: Readonly<{
  open: boolean;
  d: I18nRecord;
  onClose: () => void;
  onCreated: (detail: SymptomDetail) => void;
}>) {
  const { data: sources } = useDataSources();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [sourceKey, setSourceKey] = useState("gps_signal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveKey = keyTouched ? key : keyFrom(name);
  const keyValid = KEY_PATTERN.test(effectiveKey);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createSymptom({
        key: effectiveKey,
        name: name.trim(),
        sourceKey,
      });
      await refreshSymptoms();
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("createFailed", d));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={open} size="md" onClose={onClose}>
      <ModalHeader>{tr("createTitle", d)}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="symptom-name">{tr("name", d)}</Label>
            <TextInput
              id="symptom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="symptom-key">{tr("key", d)}</Label>
            <TextInput
              id="symptom-key"
              value={effectiveKey}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(e.target.value);
              }}
            />
            <p
              className={`mt-1 text-xs ${effectiveKey && !keyValid ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
            >
              {tr("keyHint", d)}
            </p>
          </div>
          <div>
            <Label htmlFor="symptom-source">{tr("source", d)}</Label>
            <Select
              id="symptom-source"
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value)}
            >
              {(sources ?? []).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button
          disabled={busy || !name.trim() || !keyValid}
          onClick={() => void submit()}
        >
          {tr("create", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
