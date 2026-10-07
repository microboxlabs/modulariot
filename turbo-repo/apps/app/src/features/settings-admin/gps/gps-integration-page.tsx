"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import {
  HiCheck,
  HiClipboardCopy,
  HiOutlineKey,
  HiOutlineLocationMarker,
  HiOutlineRefresh,
} from "react-icons/hi";
import { toast } from "sonner";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { CARD } from "../team/module-access";
import { useMyAccess } from "../team/team-api";
import {
  KEY_PLACEHOLDER,
  credentialsJson,
  revealSecret,
  rotateSecret,
  tokenCurl,
  trackCurl,
  useGpsIntegration,
  type GpsIntegration,
} from "./gps-integration";

interface GpsIntegrationPageProps {
  /** `pages.userSettings` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

function CopyBlock({
  text,
  d,
}: {
  readonly text: string;
  readonly d: I18nRecord;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-gray-900 p-3 pr-24 text-xs leading-relaxed text-gray-100">
        {text}
      </pre>
      <Button
        size="xs"
        color="alternative"
        className="absolute top-2 right-2"
        onClick={() => void copy()}
      >
        {copied ? (
          <HiCheck className="mr-1 h-3.5 w-3.5" />
        ) : (
          <HiClipboardCopy className="mr-1 h-3.5 w-3.5" />
        )}
        {copied ? tr("copied", d) : tr("copy", d)}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-mono text-sm break-all text-gray-900 dark:text-white">
        {value ?? "—"}
      </dd>
    </div>
  );
}

function TokenCard({
  integration,
  d,
  canRead,
  canRotate,
}: {
  readonly integration: GpsIntegration;
  readonly d: I18nRecord;
  readonly canRead: boolean;
  readonly canRotate: boolean;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const run = async (call: () => Promise<string>, done?: string) => {
    setBusy(true);
    try {
      setSecret(await call());
      if (done) toast.success(done);
    } catch {
      toast.error(tr("secretError", d));
    } finally {
      setBusy(false);
      setConfirmRotate(false);
    }
  };

  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`}>
      <div className="flex items-center gap-2">
        <HiOutlineLocationMarker className="h-5 w-5 text-blue-500" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {tr("tokenTitle", d)}
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("tokenDescription", d)}
      </p>
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={tr("clientId", d)} value={integration.clientId} />
        <Field label={tr("audience", d)} value={integration.audience} />
        <Field label={tr("tokenUrl", d)} value={integration.tokenUrl} />
        <Field label={tr("trackUrl", d)} value={integration.trackUrl} />
      </dl>

      {integration.secretAvailable && (canRead || canRotate) && (
        <div className="flex flex-wrap items-center gap-2">
          {canRead && !secret && (
            <Button
              size="sm"
              color="alternative"
              disabled={busy}
              onClick={() => void run(revealSecret)}
            >
              <HiOutlineKey className="mr-1 h-4 w-4" />
              {tr("reveal", d)}
            </Button>
          )}
          {canRotate && (
            <Button
              size="sm"
              color="alternative"
              disabled={busy}
              onClick={() => setConfirmRotate(true)}
            >
              <HiOutlineRefresh className="mr-1 h-4 w-4" />
              {tr("rotate", d)}
            </Button>
          )}
          {secret && <Badge color="warning">{tr("secretShown", d)}</Badge>}
        </div>
      )}
      {!integration.secretAvailable && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("secretUnavailable", d)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {tr("credentials", d)}
        </h3>
        <CopyBlock text={credentialsJson(integration, secret)} d={d} />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {tr("loginExample", d)}
        </h3>
        <CopyBlock text={tokenCurl(integration, secret)} d={d} />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {tr("trackExample", d)}
        </h3>
        <CopyBlock
          text={trackCurl(integration.trackUrl, "<access_token>")}
          d={d}
        />
      </div>

      <ConfirmationModal
        isOpen={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        onConfirm={() => void run(rotateSecret, tr("rotated", d))}
        title={tr("rotateTitle", d)}
        description={tr("rotateDescription", d)}
        confirmLabel={tr("rotate", d)}
        isProcessing={busy}
        variant="danger"
      />
    </section>
  );
}

function KeyCard({
  integration,
  d,
  lang,
}: {
  readonly integration: GpsIntegration;
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`}>
      <div className="flex items-center gap-2">
        <HiOutlineKey className="h-5 w-5 text-blue-500" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {tr("keyTitle", d)}
        </h2>
      </div>
      {integration.keyTrackUrl ? (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>
              {tr("keyStep1", d)}{" "}
              <Link
                href={`/${lang}/users/settings/team?tab=keys`}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {tr("keyStep1Link", d)}
              </Link>
            </li>
            <li>{tr("keyStep2", d)}</li>
            <li>{tr("keyStep3", d)}</li>
          </ol>
          <Field label={tr("trackUrl", d)} value={integration.keyTrackUrl} />
          <CopyBlock
            text={trackCurl(integration.keyTrackUrl, KEY_PLACEHOLDER)}
            d={d}
          />
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("keyUnavailable", d)}
        </p>
      )}
    </section>
  );
}

/** Settings › GPS: how the organization's GPS provider sends positions. */
export default function GpsIntegrationPage({
  dict,
  lang,
}: GpsIntegrationPageProps) {
  const d = (dict?.gps as I18nRecord) ?? {};
  const { access, accessError, can } = useMyAccess();
  const allowed = can("gps:view");
  const integration = useGpsIntegration(allowed);
  const failed = Boolean(accessError || integration.error);
  const loading = !failed && (!access || integration.isLoading);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "gps"]}
          disableLinks
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto dark:bg-gray-900">
        <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-5 px-4 pt-5 pb-10">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {tr("title", d)}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {tr("description", d)}
            </p>
          </div>
          {loading && <Spinner className="mx-auto" />}
          {failed && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
          {!loading && !failed && !allowed && (
            <Alert color="gray">{tr("notAllowed", d)}</Alert>
          )}
          {!loading && !failed && allowed && integration.data && (
            <>
              <TokenCard
                integration={integration.data}
                d={d}
                canRead={can("gps:secret.read")}
                canRotate={can("gps:secret.rotate")}
              />
              <KeyCard integration={integration.data} d={d} lang={lang} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
