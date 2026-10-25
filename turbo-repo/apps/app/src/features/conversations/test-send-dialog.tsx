"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  useContacts,
  type TowerContact,
} from "@/features/symptoms/control-tower/control-tower-api";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import ChannelIcon from "./channel-icon";
import { invokeRule } from "./conversations-api";
import type { RuleStep, SampleEvent } from "./conversations-types";
import { STEP_CHANNELS, writesToGroups } from "./rule-model";
import { COMMUNICATIONS_PAGE } from "./rules-tab";
import { SAMPLE_VALUES } from "./template-editor";

export interface TestPerson {
  email: string;
  phone: string;
  name: string;
}

const EMPTY: TestPerson = { email: "", phone: "", name: "" };

/** Where a step of a test send goes: the person's phone or email, nothing, or no call for a connection step. */
export function testDestination(
  step: RuleStep,
  to: TestPerson
):
  | { kind: "phone" | "email"; address: string }
  | { kind: "none" | "connection" } {
  if (!writesToGroups(step.channel)) return { kind: "connection" };
  const phone = to.phone.trim();
  const email = to.email.trim();
  if (step.channel !== "email" && phone)
    return { kind: "phone", address: phone };
  if (step.channel !== "whatsapp" && email)
    return { kind: "email", address: email };
  return { kind: "none" };
}

/** The sample event with the template variables it leaves blank filled with fictitious values. */
export function testEvent(sample: SampleEvent): SampleEvent {
  const data = Object.fromEntries(
    Object.entries(sample.data).map(([k, v]) => [
      k,
      (v === "" || v === null) && SAMPLE_VALUES[k] ? SAMPLE_VALUES[k] : v,
    ])
  );
  return { ...sample, data };
}

function noAddress(channel: RuleStep["channel"], d: I18nRecord): string {
  if (channel === "email") return tr("testSendNoEmail", d);
  if (channel === "whatsapp") return tr("testSendNoPhone", d);
  return tr("testSendNoAddress", d);
}

function personOf(c: TowerContact): TestPerson {
  return {
    name: c.name,
    email: c.channels?.email ?? "",
    phone: c.channels?.whatsapp ?? c.phone ?? "",
  };
}

/** Content keys keep the read-only preview stable when steps are reordered. */
function previewSteps(steps: RuleStep[]) {
  const seen = new Map<string, number>();
  return steps.map((step) => {
    const content = JSON.stringify(step);
    const occurrence = seen.get(content) ?? 0;
    seen.set(content, occurrence + 1);
    return { step, key: `${content}:${occurrence}` };
  });
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * ▶ on a rule: sends its draft for real to one person, each step at its time, with a sample event. The person
 * comes from the contact book or is typed.
 */
export default function TestSendDialog({
  open,
  ruleId,
  groups,
  steps,
  sample,
  lang,
  d,
  beforeSend,
  onClose,
}: Readonly<{
  open: boolean;
  ruleId: string;
  /** The ids of the rule's groups: the person replaces each of them. */
  groups: string[];
  steps: RuleStep[];
  sample: SampleEvent;
  lang: string;
  d: I18nRecord;
  /** Saves the pending edits, so the test sends what is on screen. */
  beforeSend: () => Promise<void>;
  onClose: () => void;
}>) {
  const [to, setTo] = useState<TestPerson>(EMPTY);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const { data: contacts } = useContacts(open);
  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return (contacts ?? [])
      .filter((c) => c.active)
      .filter((c) => {
        const text = fold(
          `${c.name} ${c.role ?? ""} ${c.company ?? ""} ${c.channels?.email ?? ""}`
        );
        return words.every((w) => text.includes(w));
      })
      .slice(0, 6);
  }, [contacts, query]);
  const reachable = steps.some((s) => {
    const k = testDestination(s, to).kind;
    return k === "phone" || k === "email";
  });

  const close = () => {
    if (busy) return;
    setStarted(false);
    setError(null);
    onClose();
  };
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await beforeSend();
      const person = {
        name: to.name.trim() || null,
        email: to.email.trim() || null,
        phone: to.phone.trim() || null,
      };
      await invokeRule(ruleId, {
        version: "draft",
        event: testEvent(sample),
        to: Object.fromEntries(groups.map((g) => [g, [person]])),
      });
      setStarted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={open} size="lg" onClose={close}>
      <ModalHeader>{tr("testSendTitle", d)}</ModalHeader>
      <ModalBody>
        {started ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {tr("testSendStarted", d)}{" "}
            <Link
              href={`/${lang}${COMMUNICATIONS_PAGE}?section=activity`}
              className="font-medium text-blue-600 hover:underline dark:text-blue-500"
            >
              {tr("testSendActivity", d)}
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className={`text-sm ${MUTED}`}>{tr("testSendHint", d)}</p>
            <div className="relative">
              <Label htmlFor="test-send-contact">
                {tr("testSendFromBook", d)}
              </Label>
              <TextInput
                id="test-send-contact"
                sizing="sm"
                value={query}
                placeholder={tr("testSendSearch", d)}
                onChange={(e) => setQuery(e.target.value)}
              />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-sm shadow-lg dark:border-gray-600 dark:bg-gray-700">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => {
                          setTo(personOf(c));
                          setQuery("");
                        }}
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {c.name}
                        </span>
                        <span className={`text-xs ${MUTED}`}>
                          {[
                            c.role,
                            c.channels?.email,
                            c.channels?.whatsapp ?? c.phone,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="test-send-name">{tr("testSendName", d)}</Label>
                <TextInput
                  id="test-send-name"
                  sizing="sm"
                  value={to.name}
                  onChange={(e) => setTo({ ...to, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="test-send-email">
                  {tr("testSendEmail", d)}
                </Label>
                <TextInput
                  id="test-send-email"
                  sizing="sm"
                  type="email"
                  placeholder="nombre@example.com"
                  value={to.email}
                  onChange={(e) => setTo({ ...to, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="test-send-phone">
                  {tr("testSendPhone", d)}
                </Label>
                <TextInput
                  id="test-send-phone"
                  sizing="sm"
                  placeholder="+56 9 1234 5678"
                  value={to.phone}
                  onChange={(e) => setTo({ ...to, phone: e.target.value })}
                />
              </div>
            </div>
            <ol
              aria-label={tr("testSendSteps", d)}
              className="flex flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              {previewSteps(steps).map(({ step: s, key }, i) => {
                const dest = testDestination(s, to);
                const label = STEP_CHANNELS.find(
                  (c) => c.value === s.channel
                )?.label;
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span className={`w-14 shrink-0 text-xs ${MUTED}`}>
                      {tr("stepN", d, { n: String(i + 1) })}
                    </span>
                    <ChannelIcon channel={s.channel} size={5} />
                    <span>{label ? trDynamic(label, d) : s.channel}</span>
                    <span aria-hidden className="text-gray-400">
                      →
                    </span>
                    {dest.kind === "phone" || dest.kind === "email" ? (
                      <span className="font-mono text-xs">{dest.address}</span>
                    ) : (
                      <span className={`text-xs ${MUTED}`}>
                        {dest.kind === "connection"
                          ? tr("testSendNoCall", d)
                          : noAddress(s.channel, d)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {error && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" disabled={busy} onClick={close}>
          {started ? tr("close", d) : tr("cancel", d)}
        </Button>
        {!started && (
          <Button disabled={busy || !reachable} onClick={() => void send()}>
            {tr("testSendGo", d)}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
