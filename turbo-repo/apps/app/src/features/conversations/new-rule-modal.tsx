"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Select,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import {
  KEY_PATTERN,
  keyFrom,
} from "@/features/symptoms/maintainer/create-symptom-modal";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { createRule, refreshRules, useEventCatalog } from "./conversations-api";
import type { EventTypeInfo, RuleDetail } from "./conversations-types";
import {
  eventGroups,
  eventLabel,
  newRuleSpec,
  SYMPTOM_OPENED,
  triggerSummary,
} from "./rule-model";
import { COMMUNICATIONS_PAGE } from "./rules-tab";
import { useSymptomNames } from "./use-symptom-names";

/** The API's longest name. */
const NAME_MAX = 200;

export interface NewRulePrefill {
  event?: string;
  when?: string;
  name?: string;
}

/** Comunicaciones with the "Nueva regla" modal open, its trigger and name filled in. */
export function newRuleHref(lang: string, prefill: NewRulePrefill = {}) {
  const q = new URLSearchParams({ new: "1" });
  if (prefill.event) q.set("event", prefill.event);
  if (prefill.when) q.set("when", prefill.when);
  if (prefill.name) q.set("name", prefill.name);
  return `/${lang}${COMMUNICATIONS_PAGE}?${q.toString()}`;
}

/** The prefill a Comunicaciones link carries, or null when it does not open the modal. */
export function prefillFrom(params: URLSearchParams): NewRulePrefill | null {
  if (params.get("new") !== "1") return null;
  return {
    event: params.get("event") ?? undefined,
    when: params.get("when") ?? undefined,
    name: params.get("name") ?? undefined,
  };
}

/** The events a rule can start on: the catalog's, plus the prefilled one if the catalog lacks it. */
function eventOptions(catalog: EventTypeInfo[] | undefined, event: string) {
  const types = (catalog ?? []).map((e) => e.type);
  return types.includes(event) ? types : [event, ...types];
}

function createError(e: unknown, d: I18nRecord) {
  if (e instanceof ControlTowerError && e.status === 409)
    return tr("ruleKeyTaken", d);
  if (e instanceof ControlTowerError && e.status === 403)
    return tr("newRuleNoAccess", d);
  return tr("createRuleFailed", d);
}

/** The form; mounted fresh each time the modal opens, so it starts from the prefill. */
function NewRuleForm({
  prefill,
  canWrite,
  accessKnown,
  d,
  onClose,
  onCreated,
}: Readonly<{
  prefill: NewRulePrefill;
  canWrite: boolean;
  accessKnown: boolean;
  d: I18nRecord;
  onClose: () => void;
  onCreated: (detail: RuleDetail) => void;
}>) {
  const { data: catalog } = useEventCatalog();
  const symptomName = useSymptomNames();
  const [name, setName] = useState(prefill.name ?? "");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const prefilledEvent = prefill.event || SYMPTOM_OPENED;
  const [event, setEvent] = useState(prefilledEvent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The prefilled condition names the prefilled event's data; another event drops it.
  const when = event === prefilledEvent ? (prefill.when ?? "") : "";
  const spec = newRuleSpec(event, when);
  const effectiveKey = keyTouched ? key : keyFrom(name);
  const keyValid = KEY_PATTERN.test(effectiveKey);
  // A modal dismissed while creating must not navigate when the request lands.
  const mounted = useRef(true);
  // The platform's catalog has no symptom events: start on its first event instead.
  useEffect(() => {
    if (prefill.event || !catalog?.length) return;
    if (!catalog.some((e) => e.type === event)) setEvent(catalog[0].type);
  }, [catalog, event, prefill.event]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createRule({
        key: effectiveKey,
        name: name.trim(),
        spec,
      });
      await refreshRules();
      if (mounted.current) onCreated(created);
    } catch (e) {
      if (!mounted.current) return;
      setError(createError(e, d));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="rule-name">{tr("ruleName", d)}</Label>
        <TextInput
          id="rule-name"
          maxLength={NAME_MAX}
          disabled={!canWrite}
          placeholder={tr("ruleNamePlaceholder", d)}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="rule-key">{tr("ruleKey", d)}</Label>
        <TextInput
          id="rule-key"
          disabled={!canWrite}
          value={effectiveKey}
          onChange={(e) => {
            setKeyTouched(true);
            setKey(e.target.value);
          }}
        />
        <p
          className={`mt-1 text-xs ${effectiveKey && !keyValid ? "text-red-600 dark:text-red-400" : MUTED}`}
        >
          {tr("ruleKeyHint", d)}
        </p>
      </div>
      <div>
        <Label htmlFor="rule-event">{tr("eventLabel", d)}</Label>
        <Select
          id="rule-event"
          disabled={!canWrite}
          value={event}
          onChange={(e) => setEvent(e.target.value)}
        >
          {eventGroups(eventOptions(catalog, event), d).map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.types.map((type) => (
                <option key={type} value={type}>
                  {eventLabel(type, d, catalog)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <p className={`mt-1 text-xs ${MUTED}`}>
          {triggerSummary(spec.trigger, d, symptomName, catalog)}
        </p>
      </div>
      <p className={`text-sm ${MUTED}`}>{tr("newRuleHint", d)}</p>
      {accessKnown && !canWrite && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tr("newRuleNoAccess", d)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button color="alternative" onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button
          disabled={!canWrite || busy || !name.trim() || !keyValid}
          onClick={() => void submit()}
        >
          {busy ? tr("creating", d) : tr("createRule", d)}
        </Button>
      </div>
    </div>
  );
}

/** "Nueva regla": name, key and event, then the editor opens on the rule's draft. */
export default function NewRuleModal({
  open,
  prefill,
  canWrite,
  accessKnown = true,
  d,
  onClose,
  onCreated,
}: Readonly<{
  open: boolean;
  prefill: NewRulePrefill;
  canWrite: boolean;
  /** False while the permissions load: no "only maintainers" warning yet. */
  accessKnown?: boolean;
  d: I18nRecord;
  onClose: () => void;
  onCreated: (detail: RuleDetail) => void;
}>) {
  return (
    <Modal show={open} size="lg" onClose={onClose} dismissible>
      <ModalHeader>{tr("newRule", d)}</ModalHeader>
      <ModalBody>
        {open && (
          <NewRuleForm
            prefill={prefill}
            canWrite={canWrite}
            accessKnown={accessKnown}
            d={d}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
