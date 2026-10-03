"use client";

import { useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Select,
  TextInput,
} from "flowbite-react";
import { useHarnessChatContext } from "@/features/harness-chat/context/harness-chat-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ControlTowerError } from "../control-tower/control-tower-api";
import SymptomIcon from "../components/symtom-icon";
import {
  createFromTemplate,
  createSymptom,
  refreshSymptoms,
  useDataSources,
  useSymptomTemplates,
  type SymptomDetail,
  type SymptomTemplate,
} from "./maintainer-api";
import { renderDescription } from "./rule-description";
import { Spark } from "./ui/badges";
import { MUTED } from "./ui/card";

/** The API's rule for keys. */
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,94}$/;

/** `Exceso de velocidad` → `exceso-de-velocidad`, the way the API wants keys. */
export function keyFrom(name: string) {
  return name
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 95);
}

/** The API's longest name. */
const NAME_MAX = 200;

/**
 * A creation error in the page's language; the API's own messages are in English.
 * Only the blank form chooses its key, so only there does a 409 mean the key is taken.
 */
function createError(e: unknown, d: I18nRecord, keyChosen = false) {
  if (keyChosen && e instanceof ControlTowerError && e.status === 409)
    return tr("keyTaken", d);
  if (e instanceof ControlTowerError && e.status === 403)
    return tr("ownersOnly", d);
  return tr("createFailed", d);
}

/** Templates grouped by family, in the order the platform lists them. */
function byFamily(templates: SymptomTemplate[]) {
  const groups = new Map<string, SymptomTemplate[]>();
  for (const t of templates) {
    groups.set(t.family, [...(groups.get(t.family) ?? []), t]);
  }
  return [...groups.entries()];
}

function TemplateButton({
  t,
  rootDict,
  busy,
  disabled,
  onPick,
}: Readonly<{
  t: SymptomTemplate;
  rootDict: I18nRecord;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
}>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:border-blue-400 disabled:cursor-wait dark:hover:border-blue-500 ${
        busy
          ? "border-blue-400 dark:border-blue-500"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-gray-200">
        {t.icon ? (
          <SymptomIcon type={t.icon} size="h-8 w-8" dict={rootDict} />
        ) : (
          t.name.slice(0, 1)
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-white">
          {t.name}
        </span>
        <span className={`block truncate text-xs ${MUTED}`}>
          {t.description}
        </span>
      </span>
    </button>
  );
}

function HarnessBox({
  d,
  onAsk,
}: Readonly<{ d: I18nRecord; onAsk: (text: string) => void }>) {
  const [text, setText] = useState("");
  const ask = () => {
    if (text.trim()) onAsk(text.trim());
  };
  return (
    <form
      className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20"
      onSubmit={(e) => {
        e.preventDefault();
        ask();
      }}
    >
      <Spark size="h-7 w-7 text-xs" className="rounded-lg" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={tr("harnessPlaceholder", d)}
        aria-label={tr("harnessAsk", d)}
        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <Button type="submit" size="sm" disabled={!text.trim()}>
        {tr("harnessAsk", d)}
      </Button>
    </form>
  );
}

/** The plain form: name, key and source, with an empty draft. */
function BlankForm({
  d,
  onBack,
  onCreated,
}: Readonly<{
  d: I18nRecord;
  onBack: () => void;
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
      setError(createError(e, d, true));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="symptom-name">{tr("name", d)}</Label>
        <TextInput
          id="symptom-name"
          maxLength={NAME_MAX}
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
          className={`mt-1 text-xs ${effectiveKey && !keyValid ? "text-red-600 dark:text-red-400" : MUTED}`}
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
      <div className="flex justify-between gap-2">
        <Button color="alternative" onClick={onBack}>
          {tr("backToTemplates", d)}
        </Button>
        <Button
          disabled={busy || !name.trim() || !keyValid}
          onClick={() => void submit()}
        >
          {tr("create", d)}
        </Button>
      </div>
    </div>
  );
}

/**
 * Nuevo síntoma: start from a platform template (published as 0.1.0 in
 * test), hand a description to Harness, import the engine's rules or start
 * from an empty draft.
 */
export default function CreateSymptomModal({
  open,
  d,
  rootDict,
  harnessEnabled,
  importing,
  onImport,
  onClose,
  onCreated,
}: Readonly<{
  open: boolean;
  d: I18nRecord;
  rootDict: I18nRecord;
  harnessEnabled: boolean;
  importing: boolean;
  onImport: () => void;
  onClose: () => void;
  onCreated: (detail: SymptomDetail) => void;
}>) {
  const harness = useHarnessChatContext();
  const {
    data: templates,
    error: templatesError,
    mutate: reloadTemplates,
  } = useSymptomTemplates(open);
  const [blank, setBlank] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setBlank(false);
    setError(null);
    onClose();
  };

  const pick = async (t: SymptomTemplate) => {
    setCreating(t.key);
    setError(null);
    try {
      const created = await createFromTemplate(t.key);
      await refreshSymptoms();
      setBlank(false);
      onCreated(created);
    } catch (e) {
      setError(createError(e, d));
    } finally {
      setCreating(null);
    }
  };

  const ask = (text: string) => {
    harness.openWithMessage(tr("harnessPrompt", d, { text }));
    close();
  };

  return (
    <Modal show={open} size="4xl" onClose={close} dismissible>
      <ModalHeader>{tr("createTitle", d)}</ModalHeader>
      <ModalBody>
        {blank ? (
          <BlankForm
            d={d}
            onBack={() => setBlank(false)}
            onCreated={(c) => {
              setBlank(false);
              onCreated(c);
            }}
          />
        ) : (
          <>
            <p className={`mb-4 text-sm ${MUTED}`}>
              {renderDescription(tr("createIntro", d))}
            </p>
            {harnessEnabled && <HarnessBox d={d} onAsk={ask} />}
            {templatesError && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                {tr("templatesFailed", d)}{" "}
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => void reloadTemplates()}
                >
                  {tr("retry", d)}
                </button>
              </p>
            )}
            {byFamily(templates ?? []).map(([family, list]) => (
              <div key={family} className="mb-3">
                <div
                  className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}
                >
                  {family}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((t) => (
                    <TemplateButton
                      key={t.key}
                      t={t}
                      rootDict={rootDict}
                      busy={creating === t.key}
                      disabled={creating !== null}
                      onPick={() => void pick(t)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {error && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div
              className={`mt-4 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3 text-sm dark:border-gray-700 ${MUTED}`}
            >
              <span>{tr("otherWays", d)}</span>
              <button
                type="button"
                className="text-blue-700 hover:underline dark:text-blue-400"
                onClick={() => setBlank(true)}
              >
                {tr("startBlank", d)}
              </button>
              <button
                type="button"
                disabled={importing}
                className="text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-400"
                onClick={onImport}
              >
                {tr("importEngine", d)}
              </button>
            </div>
          </>
        )}
      </ModalBody>
    </Modal>
  );
}
