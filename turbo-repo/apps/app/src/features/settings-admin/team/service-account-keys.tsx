"use client";

import { useState } from "react";
import { Badge, Button, Label, Spinner, TextInput } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { CARD, SectionTitle } from "./module-access";
import { SecretOnce } from "./secret-once";
import { createKey, revokeKey } from "./team-api";
import { formatDate } from "./team-members-tab";
import {
  expiryDays,
  keyDisplay,
  keyState,
  MAX_KEY_DAYS,
  type KeyState,
} from "./team-model";
import type { ApiKey, ServiceAccount } from "./team.types";

const CELL = "px-4 py-2 align-middle";
const HEAD = "px-4 py-2 text-left text-xs font-medium uppercase text-gray-500";

const STATE_COLOR: Record<KeyState, string> = {
  active: "blue",
  expired: "gray",
  revoked: "gray",
};

interface KeyRowProps {
  readonly apiKey: ApiKey;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onRevoke: (key: ApiKey) => void;
}

function KeyRow({ apiKey, lang, d, onRevoke }: KeyRowProps) {
  const state = keyState(apiKey, new Date());
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className={`${CELL} text-gray-900 dark:text-white`}>
        {apiKey.name || "—"}
      </td>
      <td
        className={`${CELL} font-mono text-xs text-gray-600 dark:text-gray-300`}
      >
        {keyDisplay(apiKey.keyId)}
      </td>
      <td className={`${CELL} text-gray-500`}>
        {formatDate(apiKey.lastUsedAt, lang, tr("never", d))}
      </td>
      <td className={`${CELL} text-gray-500`}>
        {formatDate(apiKey.expiresAt, lang, tr("keyDaysNever", d))}
      </td>
      <td className={CELL}>
        <Badge color={STATE_COLOR[state]} className="inline-flex">
          {state === "revoked"
            ? tr("keyRevokedOn", d, {
                date: formatDate(apiKey.revokedAt, lang),
              })
            : tr(`key_${state}`, d)}
        </Badge>
      </td>
      <td className={`${CELL} text-right`}>
        {state !== "revoked" && (
          <Button
            size="xs"
            color="alternative"
            onClick={() => onRevoke(apiKey)}
          >
            {tr("revoke", d)}
          </Button>
        )}
      </td>
    </tr>
  );
}

interface NewKeyFormProps {
  readonly account: ServiceAccount;
  readonly d: I18nRecord;
  readonly onCreated: (secret: string) => void;
  readonly onCancel: () => void;
  readonly onError: (e: unknown) => void;
}

function NewKeyForm({
  account,
  d,
  onCreated,
  onCancel,
  onError,
}: NewKeyFormProps) {
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const expiresInDays = expiryDays(days);
    if (expiresInDays === null) {
      onError(
        new Error(tr("keyDaysInvalid", d, { max: String(MAX_KEY_DAYS) }))
      );
      return;
    }
    setBusy(true);
    try {
      const created = await createKey(account.id, {
        name: name.trim(),
        expiresInDays,
      });
      onCreated(created.secret);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-end dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor="key-name">{tr("colName", d)}</Label>
        <TextInput
          id="key-name"
          sizing="sm"
          placeholder={tr("keyNamePlaceholder", d)}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1 sm:w-44">
        <Label htmlFor="key-days">{tr("keyDays", d)}</Label>
        <TextInput
          id="key-days"
          type="number"
          sizing="sm"
          min={1}
          max={MAX_KEY_DAYS}
          placeholder={tr("keyDaysNever", d)}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          color="alternative"
          size="sm"
          disabled={busy}
          onClick={onCancel}
        >
          {tr("cancel", d)}
        </Button>
        <Button color="blue" size="sm" disabled={busy} onClick={submit}>
          {busy && <Spinner size="sm" className="mr-2" />}
          {tr("create", d)}
        </Button>
      </div>
    </div>
  );
}

interface ServiceAccountKeysProps {
  readonly account: ServiceAccount;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onChanged: () => void;
  readonly onError: (e: unknown) => void;
}

/** A service account's keys: create one (its secret is shown once here), revoke one. */
export function ServiceAccountKeys({
  account,
  lang,
  d,
  onChanged,
  onError,
}: ServiceAccountKeysProps) {
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await revokeKey(account.id, revoking.id);
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
      setRevoking(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle
        title={tr("tabKeys", d)}
        help={tr("keysSectionHelp", d)}
        action={
          !adding &&
          !secret && (
            <Button
              color="alternative"
              size="sm"
              onClick={() => setAdding(true)}
            >
              <HiPlus className="mr-1.5 h-4 w-4" />
              {tr("keyAdd", d)}
            </Button>
          )
        }
      />
      <div className={`${CARD} overflow-hidden`}>
        {adding && (
          <NewKeyForm
            account={account}
            d={d}
            onCancel={() => setAdding(false)}
            onError={onError}
            onCreated={(value) => {
              setAdding(false);
              setSecret(value);
              onChanged();
            }}
          />
        )}
        {secret && (
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {tr("secretTitle", d)}
            </p>
            <SecretOnce secret={secret} d={d} />
            <Button
              color="blue"
              size="sm"
              className="w-fit"
              onClick={() => setSecret(null)}
            >
              {tr("done", d)}
            </Button>
          </div>
        )}
        {account.keys.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {tr("keysEmpty", d)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className={HEAD}>{tr("colName", d)}</th>
                  <th className={HEAD}>{tr("colKey", d)}</th>
                  <th className={HEAD}>{tr("colLastUsed", d)}</th>
                  <th className={HEAD}>{tr("colExpires", d)}</th>
                  <th className={HEAD}>{tr("colStatus", d)}</th>
                  <th className={HEAD} />
                </tr>
              </thead>
              <tbody>
                {account.keys.map((key) => (
                  <KeyRow
                    key={key.id}
                    apiKey={key}
                    lang={lang}
                    d={d}
                    onRevoke={setRevoking}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmationModal
        isOpen={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title={tr("keyRevokeTitle", d)}
        description={tr("keyRevokeBody", d, {
          key: revoking ? keyDisplay(revoking.keyId) : "",
        })}
        confirmLabel={tr("revoke", d)}
        isProcessing={busy}
        variant="danger"
      />
    </section>
  );
}
