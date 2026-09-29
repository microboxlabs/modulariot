"use client";

import { useEffect, useState, type FC } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { Button, Label, TextInput } from "flowbite-react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { resolveDashletPreview } from "@/features/dashboard/dashlets/dashlet-preview";
import { useUserSite } from "@/features/common/providers/client-api.provider";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import {
  draftToDashboard,
  freeSlug,
  sizeOf,
  type DraftDashlet,
  type ShowDashboardDraftArgs,
} from "../dashboard-draft";

const CONFIG_URL = "/app/api/dashboard/config";

function savedKey(draftId: string): string {
  return `harness-dashboard-draft:${draftId}`;
}

function readSaved(draftId: string): string | null {
  try {
    return window.localStorage.getItem(savedKey(draftId));
  } catch {
    return null;
  }
}

function rememberSaved(draftId: string, slug: string): void {
  try {
    window.localStorage.setItem(savedKey(draftId), slug);
  } catch {
    // The link still shows until the page is reloaded.
  }
}

async function dashboardExists(site: string, slug: string): Promise<boolean> {
  const res = await fetch(
    `${CONFIG_URL}?site=${encodeURIComponent(site)}&slug=${encodeURIComponent(slug)}`
  );
  if (!res.ok) throw new Error(`dashboard lookup failed: ${res.status}`);
  const body = (await res.json()) as { data?: unknown };
  return body.data != null;
}

const DashletThumb: FC<{ dashlet: DraftDashlet }> = ({ dashlet }) => {
  const resolved = resolveDashletPreview(dashlet.dashletId, dashlet.config);
  if (resolved.status !== "ok") return null;
  const { Component, widget, heightPx } = resolved;
  const wide = sizeOf(dashlet.dashletId).w > 6;
  return (
    <div
      className={`overflow-hidden rounded-lg ${wide ? "col-span-2" : ""}`}
      style={{ height: heightPx }}
    >
      <Component widget={widget} editMode={false} />
    </div>
  );
};

/**
 * A dashboard the analyst assembled from widgets of the thread. Nothing is
 * stored until the user presses Create: then it is saved in the user's site
 * with the user's own session, under a slug no other dashboard uses.
 */
export const ShowDashboardDraftCard: FC<
  ToolCallMessagePartProps<ShowDashboardDraftArgs, Record<string, never>>
> = ({ args, result, addResult }) => {
  const tr = useHarnessChatTr();
  const { lang } = useParams<{ lang?: string }>();
  const { siteName, siteTitle } = useUserSite();
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(args.title ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!result) addResult({});
    if (args.id) setSlug(readSaved(args.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashlets = args.dashlets ?? [];
  const missing = args.missing?.length ?? 0;

  async function create(): Promise<void> {
    if (!siteName) return;
    setSaving(true);
    setFailed(false);
    try {
      const title = name.trim();
      const free = await freeSlug(title, (s) => dashboardExists(siteName, s));
      if (!free) throw new Error("no free slug");
      const res = await fetch(CONFIG_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: siteName,
          slug: free,
          config: draftToDashboard(args, title),
        }),
      });
      if (!res.ok) throw new Error(`dashboard save failed: ${res.status}`);
      rememberSaved(args.id, free);
      setSlug(free);
      await mutate(
        `/app/api/dashboard/configs?site=${encodeURIComponent(siteName)}`
      );
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-[90%] space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
      <div>
        <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
          {tr("harnessChat.ui.dashboardDraft.title")} ·{" "}
          {tr("harnessChat.ui.dashboardDraft.widgets", {
            count: String(dashlets.length),
          })}
        </p>
        <p className="font-semibold text-gray-900 dark:text-white">
          {args.title}
        </p>
        {args.description && (
          <p className="text-gray-600 dark:text-gray-300">{args.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {dashlets.map((dashlet, index) => (
          <DashletThumb key={dashlet.widgetId ?? index} dashlet={dashlet} />
        ))}
      </div>

      {missing > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {tr("harnessChat.ui.dashboardDraft.missing", {
            count: String(missing),
          })}
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("harnessChat.ui.dashboardDraft.snapshot")}
      </p>

      {slug ? (
        <p className="text-gray-900 dark:text-white">
          {tr("harnessChat.ui.dashboardDraft.created")} ·{" "}
          <Link
            href={`/${lang ?? "es"}/home/${slug}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {tr("harnessChat.ui.dashboardDraft.open")}
          </Link>
        </p>
      ) : (
        <div className="space-y-2">
          <div>
            <Label htmlFor={`dashboard-draft-${args.id}`}>
              {tr("harnessChat.ui.dashboardDraft.nameLabel")}
            </Label>
            <TextInput
              id={`dashboard-draft-${args.id}`}
              sizing="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {siteName
              ? tr("harnessChat.ui.dashboardDraft.site", {
                  site: siteTitle ?? siteName,
                })
              : tr("harnessChat.ui.dashboardDraft.noSite")}
          </p>
          {failed && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {tr("harnessChat.ui.dashboardDraft.error")}
            </p>
          )}
          <Button
            size="xs"
            onClick={() => void create()}
            disabled={
              saving || !siteName || !name.trim() || dashlets.length === 0
            }
          >
            {saving
              ? tr("harnessChat.ui.dashboardDraft.creating")
              : tr("harnessChat.ui.dashboardDraft.create")}
          </Button>
        </div>
      )}
    </div>
  );
};
