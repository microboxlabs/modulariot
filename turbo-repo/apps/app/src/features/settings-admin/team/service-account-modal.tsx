"use client";

import { useEffect, useState } from "react";
import { Label, Textarea, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ModuleRoleSelects } from "./module-role-selects";
import { SecretOnce } from "./secret-once";
import { createServiceAccount } from "./team-api";
import { expiryDays, MAX_KEY_DAYS, selectedRoles } from "./team-model";
import type { CatalogRole } from "./team.types";

interface ServiceAccountModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => void;
  readonly roles: CatalogRole[];
  readonly lang: string;
  readonly d: I18nRecord;
}

/** Creates a service account with its first key; then shows the key once. */
export function ServiceAccountModal({
  show,
  onClose,
  onCreated,
  roles,
  lang,
  d,
}: ServiceAccountModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [byModule, setByModule] = useState<Record<string, string>>({});
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setName("");
      setDescription("");
      setByModule({});
      setDays("");
      setError(null);
      setSecret(null);
    }
  }, [show]);

  const submit = async () => {
    if (secret) {
      onClose();
      return;
    }
    const expiresInDays = expiryDays(days);
    if (!name.trim()) {
      setError(new Error(tr("nameRequired", d)));
      return;
    }
    if (expiresInDays === null) {
      setError(
        new Error(tr("keyDaysInvalid", d, { max: String(MAX_KEY_DAYS) }))
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createServiceAccount({
        name: name.trim(),
        description: description.trim(),
        roles: selectedRoles(byModule),
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
      isOpen={show}
      onClose={onClose}
      title={secret ? tr("secretTitle", d) : tr("accountCreateTitle", d)}
      subtitle={secret ? undefined : tr("accountCreateSubtitle", d)}
      submitLabel={secret ? tr("close", d) : tr("create", d)}
      showCancelButton={!secret}
      isProcessing={busy}
      error={error}
      onSubmit={submit}
      size="2xl"
    >
      {secret ? (
        <SecretOnce secret={secret} d={d} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="account-name">{tr("colName", d)}</Label>
              <TextInput
                id="account-name"
                sizing="sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="account-days">{tr("keyDays", d)}</Label>
              <TextInput
                id="account-days"
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
          <div className="flex flex-col gap-1">
            <Label htmlFor="account-description">
              {tr("colDescription", d)}
            </Label>
            <Textarea
              id="account-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {roles.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {tr("moduleAccess", d)}
              </span>
              <ModuleRoleSelects
                roles={roles}
                value={byModule}
                onChange={setByModule}
                lang={lang}
                d={d}
              />
            </div>
          )}
        </div>
      )}
    </FormModal>
  );
}
