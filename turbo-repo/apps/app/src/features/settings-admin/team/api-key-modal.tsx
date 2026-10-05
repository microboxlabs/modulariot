"use client";

import { useEffect, useState } from "react";
import { Label, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SecretOnce } from "./secret-once";
import { createKey } from "./team-api";
import { expiryDays, MAX_KEY_DAYS } from "./team-model";
import type { ServiceAccount } from "./team.types";

interface ApiKeyModalProps {
  readonly account: ServiceAccount | null;
  readonly onClose: () => void;
  readonly onCreated: () => void;
  readonly d: I18nRecord;
}

/** Adds a key to a service account; then shows the key once. */
export function ApiKeyModal({
  account,
  onClose,
  onCreated,
  d,
}: ApiKeyModalProps) {
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    setName("");
    setDays("");
    setError(null);
    setSecret(null);
  }, [account]);

  const submit = async () => {
    if (secret || !account) {
      onClose();
      return;
    }
    const expiresInDays = expiryDays(days);
    if (expiresInDays === null) {
      setError(
        new Error(tr("keyDaysInvalid", d, { max: String(MAX_KEY_DAYS) }))
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createKey(account.id, {
        name: name.trim(),
        expiresInDays,
      });
      setSecret(created.secret);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(tr("saveFailed", d)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={account !== null}
      onClose={onClose}
      title={
        secret
          ? tr("secretTitle", d)
          : tr("keyCreateTitle", d, { name: account?.name ?? "" })
      }
      submitLabel={secret ? tr("close", d) : tr("create", d)}
      showCancelButton={!secret}
      isProcessing={busy}
      error={error}
      onSubmit={submit}
    >
      {secret ? (
        <SecretOnce secret={secret} d={d} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="key-name">{tr("colName", d)}</Label>
            <TextInput
              id="key-name"
              sizing="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
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
        </div>
      )}
    </FormModal>
  );
}
