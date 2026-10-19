"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Label,
  Spinner,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiOutlineChip } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  CARD,
  DetailShell,
  EffectivePermissions,
  ModuleCard,
  SectionTitle,
} from "./module-access";
import { SecretOnce } from "./secret-once";
import { createServiceAccount, useAccessCatalog } from "./team-api";
import {
  catalogModules,
  effectivePermissions,
  expiryDays,
  MAX_KEY_DAYS,
  selectedRoles,
} from "./team-model";
import type { AccessCatalog, CreatedServiceAccount } from "./team.types";

interface ServiceAccountCreatePageProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** Settings › Team › new service account: details, module access, and its first key. */
export default function ServiceAccountCreatePage({
  dict,
  lang,
}: ServiceAccountCreatePageProps) {
  const d = dict?.team as I18nRecord;
  const { data: catalog, error } = useAccessCatalog();
  const keysPath = `/${lang}/users/settings/team?tab=keys`;
  const [created, setCreated] = useState<CreatedServiceAccount | null>(null);

  return (
    <DetailShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      backHref={keysPath}
      backLabel={tr("backToKeys", d)}
    >
      {!catalog && !error && <Spinner className="mx-auto" />}
      {error && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
      {catalog && !created && (
        <CreateForm
          catalog={catalog}
          keysPath={keysPath}
          lang={lang}
          d={d}
          onCreated={setCreated}
        />
      )}
      {created && (
        <div
          className={`${CARD} mx-auto flex w-full max-w-2xl flex-col gap-4 p-6`}
        >
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {tr("accountCreated", d, { name: created.serviceAccount.name })}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("secretTitle", d)}
            </p>
          </div>
          <SecretOnce secret={created.secret} d={d} />
          <div className="flex justify-end gap-2">
            <Button as={Link} href={keysPath} color="alternative" size="sm">
              {tr("backToKeys", d)}
            </Button>
            <Button
              as={Link}
              href={`/${lang}/users/settings/team/service-accounts/${encodeURIComponent(created.serviceAccount.id)}`}
              color="blue"
              size="sm"
            >
              {tr("openAccount", d)}
            </Button>
          </div>
        </div>
      )}
    </DetailShell>
  );
}

interface CreateFormProps {
  readonly catalog: AccessCatalog;
  readonly keysPath: string;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onCreated: (created: CreatedServiceAccount) => void;
}

function CreateForm({
  catalog,
  keysPath,
  lang,
  d,
  onCreated,
}: CreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState("");
  const [byModule, setByModule] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = selectedRoles(byModule);
  const modules = useMemo(() => catalogModules(catalog), [catalog]);

  const submit = async () => {
    const expiresInDays = expiryDays(days);
    if (!name.trim()) {
      setError(tr("nameRequired", d));
      return;
    }
    if (expiresInDays === null) {
      setError(tr("keyDaysInvalid", d, { max: String(MAX_KEY_DAYS) }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await createServiceAccount({
          name: name.trim(),
          description: description.trim(),
          roles,
          expiresInDays,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
      setBusy(false);
    }
  };

  return (
    <>
      <div className={`${CARD} flex items-center gap-4 p-5`}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
          <HiOutlineChip className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {tr("accountCreateTitle", d)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("accountCreateSubtitle", d)}
          </p>
        </div>
      </div>
      {error && (
        <Alert color="gray" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <SectionTitle title={tr("accountDetails", d)} />
            <div className={`${CARD} flex flex-col gap-4 p-4`}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor="account-name">{tr("colName", d)}</Label>
                  <TextInput
                    id="account-name"
                    sizing="sm"
                    placeholder={tr("accountNamePlaceholder", d)}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="account-days">{tr("firstKeyDays", d)}</Label>
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
                  placeholder={tr("accountDescriptionPlaceholder", d)}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </section>
          <section className="flex flex-col gap-4">
            <SectionTitle
              title={tr("moduleAccessTitle", d)}
              help={tr("accountAccessHelp", d)}
            />
            {modules.map((mod) => (
              <ModuleCard
                key={mod.key}
                mod={mod}
                roles={catalog.roles.filter((r) => r.module === mod.key)}
                catalog={catalog}
                value={byModule[mod.key] ?? ""}
                includedByBase={false}
                disabled={busy}
                lang={lang}
                d={d}
                onChange={(key) => setByModule({ ...byModule, [mod.key]: key })}
              />
            ))}
          </section>
        </div>
        <aside className="lg:col-span-1">
          <EffectivePermissions
            permissions={effectivePermissions("MEMBER", roles, catalog)}
            catalog={catalog}
            modules={modules}
            help={tr("accountEffectiveHelp", d)}
            lang={lang}
            d={d}
          />
        </aside>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex justify-end gap-2 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <Button as={Link} href={keysPath} color="alternative" size="sm">
          {tr("cancel", d)}
        </Button>
        <Button color="blue" size="sm" disabled={busy} onClick={submit}>
          {busy && <Spinner size="sm" className="mr-2" />}
          {tr("accountCreate", d)}
        </Button>
      </div>
    </>
  );
}
