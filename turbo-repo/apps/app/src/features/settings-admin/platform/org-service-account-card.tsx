"use client";

import { useState } from "react";
import { Badge, Button, Spinner } from "flowbite-react";
import { HiOutlineIdentification } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  checkOrgServiceAccount,
  setOrgServiceAccount,
  useOrgServiceAccount,
  type OrgServiceAccountView,
} from "./org-service-account";

interface OrgServiceAccountCardProps {
  readonly slug: string;
  /** `pages.userSettings.organizations` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

type Busy = "disable" | "enable" | "check" | null;

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatTime(iso: string | null, lang: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface AccountDetailsProps {
  readonly account: OrgServiceAccountView;
  readonly dict: I18nRecord;
  readonly lang: string;
}

function AccountDetails({ account, dict, lang }: AccountDetailsProps) {
  return (
    <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <dt className="text-xs text-gray-500 dark:text-gray-400">
          {tr("email", dict)}
        </dt>
        <dd className="flex items-center gap-2 font-mono text-sm break-all text-gray-900 dark:text-white">
          {account.email}
          <Badge color={account.disabled ? "gray" : "success"}>
            {account.disabled ? tr("disabled", dict) : tr("active", dict)}
          </Badge>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500 dark:text-gray-400">
          {tr("createdBy", dict)}
        </dt>
        <dd className="text-sm text-gray-900 dark:text-white">
          {account.createdBy ?? "—"} · {formatTime(account.createdAt, lang)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500 dark:text-gray-400">
          {tr("updatedBy", dict)}
        </dt>
        <dd className="text-sm text-gray-900 dark:text-white">
          {account.updatedBy ?? "—"} · {formatTime(account.updatedAt, lang)}
        </dd>
      </div>
    </dl>
  );
}

/**
 * The organization's Google service account, for a platform owner: check that
 * the platform can act as it, and disable or enable it. It is created with the
 * organization's managed BigQuery connection, in Conexiones.
 */
export default function OrgServiceAccountCard(
  props: OrgServiceAccountCardProps
) {
  return <OrgServiceAccountSession key={props.slug} {...props} />;
}

function OrgServiceAccountSession({
  slug,
  dict: orgsDict,
  lang,
}: OrgServiceAccountCardProps) {
  const dict = (orgsDict?.serviceAccount as I18nRecord) ?? {};
  const { state, error, isLoading, mutate } = useOrgServiceAccount(slug, true);
  const [busy, setBusy] = useState<Busy>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const run = async (action: Exclude<Busy, null>) => {
    setBusy(action);
    setCheckResult(null);
    try {
      if (action === "check") {
        const check = await checkOrgServiceAccount(slug);
        setCheckResult(
          check.disabled
            ? tr("checkDisabled", dict)
            : tr("checkOk", dict, {
                until: formatTime(check.tokenExpiresAt, lang),
              })
        );
        return;
      }
      await mutate(await setOrgServiceAccount(slug, action), {
        revalidate: false,
      });
    } catch (e) {
      toast.error(errorText(e, tr("actionError", dict)));
    } finally {
      setBusy(null);
    }
  };

  const account = state?.account ?? null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <HiOutlineIdentification className="h-5 w-5 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("title", dict)}
        </h3>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      {isLoading && <Spinner size="sm" className="mt-4" />}
      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}
      {state && !state.configured && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
          {tr("notConfigured", dict)}
        </p>
      )}

      {state?.configured && !account && (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
          {tr("none", dict)}
        </p>
      )}

      {account && (
        <>
          <AccountDetails account={account} dict={dict} lang={lang} />
          {checkResult && (
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              {checkResult}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              size="sm"
              color="alternative"
              disabled={busy !== null}
              onClick={() => void run("check")}
            >
              {busy === "check" ? tr("checking", dict) : tr("check", dict)}
            </Button>
            <Button
              size="sm"
              color={account.disabled ? "blue" : "light"}
              disabled={busy !== null}
              onClick={() => void run(account.disabled ? "enable" : "disable")}
            >
              {account.disabled ? tr("enable", dict) : tr("disable", dict)}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
