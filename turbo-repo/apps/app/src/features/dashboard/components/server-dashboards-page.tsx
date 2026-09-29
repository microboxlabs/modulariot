"use client";

import { useMemo, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useUnsavedNavigation } from "@/features/common/hooks/use-unsaved-navigation";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button, TextInput } from "flowbite-react";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { createDashboardServerClient } from "../services/dashboard-server-client";
import { DEFAULT_STORAGE } from "../types/dashboard.types";
import { useDashboardDocument } from "../hooks/use-dashboard-document";
import { DashboardProvider } from "../context/dashboard-context";
import {
  DashboardQuerySession,
  SavedQueryResults,
} from "../context/saved-query-context";
import { DashboardView } from "./dashboard-view";

type Props = { lang: string; slug?: string; dictionary: I18nRecord };
const EMPTY_QUERIES: NonNullable<typeof DEFAULT_STORAGE.queries> = [];

/** Parallel entry point: organization membership replaces legacy site discovery. */
export function ServerDashboardsPage(props: Readonly<Props>) {
  const { activeOrg, error, isLoading } = useOrgScopes();
  const t = (key: string) => tr(`dashboard.server.${key}`, props.dictionary);
  if (error)
    return (
      <p role="alert" className="p-6">
        {t("loadError")}
      </p>
    );
  if (isLoading || !activeOrg)
    return <output className="block p-6">{t("loading")}</output>;
  return props.slug ? (
    <ServerDashboardEditor
      key={`${activeOrg.slug}/${props.slug}`}
      {...props}
      slug={props.slug}
      org={activeOrg.slug}
    />
  ) : (
    <ServerDashboardList
      key={activeOrg.slug}
      {...props}
      org={activeOrg.slug}
    />
  );
}

function ServerDashboardList({
  org,
  lang,
  dictionary,
}: Readonly<Props & { org: string }>) {
  const client = useMemo(() => createDashboardServerClient(org), [org]);
  const { data, error, isLoading } = useSWR(client.key(), () => client.list(), {
    shouldRetryOnError: false,
  });
  const { data: scope, error: scopeError, isValidating: checkingScope } = useSWR(
    client.scopeKey,
    () => client.scopeCapabilities(),
    { shouldRetryOnError: false, revalidateOnMount: true }
  );
  const canCreate = !scopeError && !checkingScope && scope?.canCreate === true;
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const router = useRouter();
  const t = (key: string) => tr(`dashboard.server.${key}`, dictionary);
  async function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || creating || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return;
    setCreating(true);
    setCreateError(false);
    try {
      await client.save(
        slug,
        { ...DEFAULT_STORAGE, name: t("newName") },
        '"0"'
      );
      router.push(`/${lang}/dashboards/${encodeURIComponent(slug)}`);
    } catch {
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  }
  return (
    <section className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-gray-500">{t("parallel")}</p>
      {canCreate && (
        <form onSubmit={create} className="flex max-w-lg gap-3">
          <TextInput
            aria-label={t("slug")}
            placeholder={t("slug")}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            pattern="[a-z0-9][a-z0-9-]{0,79}"
            required
            maxLength={80}
            disabled={creating}
          />
          <Button type="submit" disabled={creating}>
            {t("create")}
          </Button>
        </form>
      )}
      {(error || scopeError || createError) && (
        <p role="alert">{t(createError ? "createError" : "loadError")}</p>
      )}
      {isLoading && <output>{t("loading")}</output>}
      {data?.length === 0 && <p>{t("empty")}</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((dashboard) => (
          <li key={dashboard.slug}>
            <Link
              className="block rounded-lg border p-5 hover:bg-gray-50 dark:hover:bg-gray-800"
              href={`/${lang}/dashboards/${encodeURIComponent(dashboard.slug)}`}
            >
              {dashboard.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ServerDashboardEditor({
  org,
  slug,
  lang,
  dictionary,
}: Readonly<Props & { org: string; slug: string }>) {
  const t = (key: string) => tr(`dashboard.server.${key}`, dictionary);
  const empty = useMemo(
    () => ({
      ...DEFAULT_STORAGE,
      name: tr("dashboard.server.newName", dictionary),
    }),
    [dictionary]
  );
  const document = useDashboardDocument(org, slug, empty);
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  useUnsavedNavigation(document.dirty, t("leave"));
  async function reload() {
    if (!document.dirty || globalThis.confirm(t("discard")))
      await document.discardAndReload();
  }
  async function remove() {
    if (removing || document.busy || !globalThis.confirm(t("confirmDelete")))
      return;
    setRemoving(true);
    setRemoveError(false);
    try {
      await document.client.remove(slug);
      router.push(`/${lang}/dashboards`);
    } catch {
      setRemoveError(true);
    } finally {
      setRemoving(false);
    }
  }
  if (!document.isLoaded)
    return (
      <p className="p-6" role={document.error ? "alert" : "status"}>
        {t(document.error ? "loadError" : "loading")}
      </p>
    );
  if (!document.exists)
    return (
      <p role="alert" className="p-6">
        {t("loadError")}
      </p>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <Link href={`/${lang}/dashboards`}>{t("title")}</Link>
        <TextInput
          aria-label={t("name")}
          value={document.config.name}
          disabled={document.readOnly || removing}
          onChange={(event) =>
            document.onChange({ ...document.config, name: event.target.value })
          }
        />
        {document.capabilities?.canEdit && (
          <Button
            size="sm"
            disabled={!document.dirty || document.readOnly || removing}
            onClick={() => void document.save()}
          >
            {t("save")}
          </Button>
        )}
        <Button
          size="sm"
          color="light"
          disabled={document.busy || removing}
          onClick={() => void reload()}
        >
          {t("reload")}
        </Button>
        {document.capabilities?.canDelete && (
          <Button
            size="sm"
            color="failure"
            disabled={document.busy || removing}
            onClick={() => void remove()}
          >
            {t("delete")}
          </Button>
        )}
        {document.dirty && <output className="text-sm">{t("unsaved")}</output>}
      </div>
      {(document.error || removeError) && (
        <p role="alert" className="p-3 text-red-600">
          {t(document.error === 409 ? "conflict" : "saveError")}
        </p>
      )}
      <DashboardQuerySession
        client={document.client}
        slug={slug}
        queries={document.config.queries ?? EMPTY_QUERIES}
        errorMessage={t("queryError")}
      >
        <DashboardProvider
          key={document.editorKey}
          slug={slug}
          dictionary={dictionary}
          dataProvider={SavedQueryResults}
          storage={{
            config: document.config,
            isLoaded: document.isLoaded,
            readOnly: document.readOnly || removing,
            onChange: document.onChange,
          }}
        >
          <DashboardView />
        </DashboardProvider>
      </DashboardQuerySession>
    </div>
  );
}
