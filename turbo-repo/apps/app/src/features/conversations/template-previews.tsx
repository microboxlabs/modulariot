"use client";

import { useEffect, useState } from "react";
import {
  HiExternalLink,
  HiMenuAlt2,
  HiPhone,
  HiReply,
  HiUserCircle,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Panel } from "@/features/symptoms/maintainer/symptom-side-panels";
import AdaptiveCardView from "./adaptive-card-view";
import { channelLogo } from "./channel-icon";
import {
  previewTemplateEmail,
  previewTemplateTeams,
} from "./conversations-api";
import type {
  EmailPreview as EmailPreviewData,
  EmailVariant,
  MetaTemplate,
  TeamsMessage,
  TeamsVariant,
  TemplateBody,
} from "./conversations-types";
import WhatsAppText, { filled } from "./whatsapp-text";

// Meta has more button types (COPY_CODE, FLOW, OTP…); those show without an icon.
const BUTTON_ICON: Partial<Record<string, typeof HiReply>> = {
  QUICK_REPLY: HiReply,
  URL: HiExternalLink,
  PHONE_NUMBER: HiPhone,
};

/** The message in a WhatsApp chat: the business's header bar, the wallpaper, the bubble and its buttons. */
export function WhatsAppPhone({
  text,
  values,
  meta,
  d,
}: Readonly<{
  text: string;
  values: Record<string, string>;
  /** Meta's header, footer and buttons go around the text. */
  meta: MetaTemplate | null;
  d: I18nRecord;
}>) {
  const header = meta?.headerFormat === "TEXT" ? meta.header : null;
  return (
    <figure
      aria-label={tr("previewWhatsappLabel", d)}
      className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center gap-2 bg-[#008069] px-3 py-2 text-white dark:bg-[#202c33]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          M
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">ModularIoT</span>
          <span className="block text-[11px] text-white/80">
            {tr("previewBusinessAccount", d)}
          </span>
        </span>
      </div>
      <div className="flex min-h-48 flex-col gap-1 bg-[#efeae2] px-3 py-4 dark:bg-[#0b141a]">
        <span className="mb-2 self-center rounded-md bg-white/90 px-2 py-0.5 text-[11px] uppercase text-gray-600 shadow-sm dark:bg-[#182229] dark:text-gray-400">
          {tr("previewToday", d)}
        </span>
        <div className="relative max-w-[90%] self-start rounded-lg rounded-tl-none bg-white px-2.5 pt-1.5 pb-1 text-[14px] leading-snug text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
          <span
            aria-hidden
            className="absolute top-0 -left-2 h-0 w-0 border-t-[10px] border-l-[10px] border-t-white border-l-transparent dark:border-t-[#202c33]"
          />
          {header && (
            <p className="mb-1 font-semibold">
              <WhatsAppText text={header} values={values} />
            </p>
          )}
          <p className="whitespace-pre-wrap break-words">
            {text.trim() ? (
              <WhatsAppText text={text} values={values} />
            ) : (
              <span className="text-gray-400">{tr("previewEmpty", d)}</span>
            )}
          </p>
          {meta?.footer && (
            <p className="mt-1 text-[12px] text-[#667781] dark:text-[#8696a0]">
              {meta.footer}
            </p>
          )}
          <p className="mt-0.5 text-right text-[11px] text-[#667781] dark:text-[#8696a0]">
            {values.hora ?? "14:05"}
          </p>
        </div>
        {(meta?.buttons ?? []).map((b) => {
          const Icon = BUTTON_ICON[b.type];
          return (
            <div
              key={`${b.type}:${b.text}:${b.url ?? b.phoneNumber ?? ""}`}
              className="flex max-w-[90%] items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3 py-1.5 text-[14px] text-[#027eb5] shadow-sm dark:bg-[#202c33] dark:text-[#53bdeb]"
              style={{ minWidth: "60%" }}
            >
              {Icon && <Icon aria-hidden className="h-4 w-4" />}
              {b.text || "—"}
            </div>
          );
        })}
      </div>
    </figure>
  );
}

interface PreviewState {
  key: string;
  data?: EmailPreviewData;
  error?: string;
}

/**
 * The email as the backend writes it, with the values in and inside the layout. Asked again 400 ms after the
 * last change; the last answer stays while the next one comes.
 */
export function useEmailPreview(
  email: EmailVariant | null,
  values: Record<string, string>
): PreviewState {
  const key = JSON.stringify([email?.subject ?? "", email?.html ?? "", values]);
  const [state, setState] = useState<PreviewState>({ key: "" });
  useEffect(() => {
    const [subject, html, vals] = JSON.parse(key) as [
      string,
      string,
      Record<string, string>,
    ];
    if (!html.trim()) return;
    let live = true;
    const timer = setTimeout(() => {
      previewTemplateEmail(subject, html, vals).then(
        (data) => {
          if (live) setState({ key, data });
        },
        (e: unknown) => {
          if (live)
            setState({
              key,
              error: e instanceof Error ? e.message : String(e),
            });
        }
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);
  return email?.html?.trim() ? state : { key };
}

/** The email in a mail reader: subject, sender and recipient, then the HTML in an isolated frame. */
export function EmailPreview({
  preview,
  to,
  d,
}: Readonly<{ preview: PreviewState; to: string; d: I18nRecord }>) {
  const { data, error } = preview;
  return (
    <figure
      aria-label={tr("previewEmailLabel", d)}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          {data?.subject.trim() || (
            <span className="text-gray-400">{tr("previewNoSubject", d)}</span>
          )}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <HiUserCircle aria-hidden className="h-8 w-8 text-gray-300" />
          <span className="min-w-0">
            <span className="block font-medium text-gray-900 dark:text-white">
              ModularIoT
            </span>
            <span className="block truncate">
              {tr("previewTo", d, { name: to })}
            </span>
          </span>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
      {data ? (
        // No scripts, forms or navigation: the frame only shows the email.
        <iframe
          title={tr("previewEmailLabel", d)}
          sandbox=""
          srcDoc={data.html}
          className="block h-[30rem] w-full bg-[#f3f4f6]"
        />
      ) : (
        !error && (
          <p className="px-4 py-3 text-sm text-gray-400">
            {tr("previewEmpty", d)}
          </p>
        )
      )}
    </figure>
  );
}

/** The text a Slack, Teams or webhook connection gets, and what the conversation history keeps. */
export function PlainPreview({
  text,
  d,
}: Readonly<{ text: string; d: I18nRecord }>) {
  return (
    <figure
      aria-label={tr("previewTextLabel", d)}
      className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-800 dark:text-gray-200">
        {text.trim() || "—"}
      </pre>
    </figure>
  );
}

interface TeamsPreviewState {
  key: string;
  data?: TeamsMessage;
  error?: string;
}

/**
 * The card as the backend builds it for a Teams step, with the values in. Asked again 400 ms after the last change;
 * the last answer stays while the next one comes.
 */
export function useTeamsPreview(
  card: TeamsVariant,
  values: Record<string, string>
): TeamsPreviewState {
  const key = JSON.stringify([card, values]);
  const [state, setState] = useState<TeamsPreviewState>({ key: "" });
  useEffect(() => {
    const [teams, vals] = JSON.parse(key) as [
      TeamsVariant,
      Record<string, string>,
    ];
    let live = true;
    const timer = setTimeout(() => {
      previewTemplateTeams(teams, vals).then(
        (data) => {
          if (live) setState({ key, data });
        },
        (e: unknown) => {
          if (live)
            setState({
              key,
              error: e instanceof Error ? e.message : String(e),
            });
        }
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);
  return state;
}

/**
 * The template's Teams card as a Teams channel shows it: the body the step sends, built by the backend with the
 * values, drawn by the Adaptive Cards renderer inside a Workflows message.
 */
export function TeamsCardPreview({
  card,
  values,
  d,
}: Readonly<{
  card: TeamsVariant;
  values: Record<string, string>;
  d: I18nRecord;
}>) {
  const preview = useTeamsPreview(card, values);
  const content = preview.data?.attachments?.[0]?.content;
  return (
    <figure
      aria-label={tr("previewTeamsLabel", d)}
      className="flex gap-3 rounded-lg bg-[#F5F5F5] p-3 text-sm dark:bg-gray-900"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#5B5FC7] to-[#3D8BFD] text-xs font-semibold text-white"
      >
        W
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {tr("previewTeamsSender", d)}
          </span>{" "}
          {SAMPLE_TIME}
        </p>
        <div className="max-w-[28rem] overflow-hidden rounded-md border border-[#E1E1E1] bg-white shadow-sm">
          {content ? (
            <AdaptiveCardView card={content} />
          ) : (
            <p
              className={`px-4 py-6 text-xs ${
                preview.error
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500"
              }`}
            >
              {preview.error
                ? tr("previewTeamsFailed", d, { error: preview.error })
                : tr("previewTeamsLoading", d)}
            </p>
          )}
        </div>
        {card.images?.field && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("previewTeamsImages", d, { field: card.images.field })}
          </p>
        )}
      </div>
    </figure>
  );
}

/** The time shown next to the sender; a fixed one, as Teams would show it. */
const SAMPLE_TIME = "22:14";

type PreviewTab = "whatsapp" | "email" | "teams" | "text";

/** What Slack, Teams and webhooks send: the short text, else the email's text. */
export function chatText(
  body: TemplateBody,
  values: Record<string, string>,
  emailText: string | undefined
): string {
  if (body.baseText.trim()) return filled(body.baseText, values);
  return emailText ?? "";
}

/** The side panel's preview: one tab per channel the template has, and the text the chats get. */
export function TemplatePreviewPanel({
  body,
  values,
  meta,
  d,
}: Readonly<{
  body: TemplateBody;
  values: Record<string, string>;
  meta: MetaTemplate | null;
  d: I18nRecord;
}>) {
  const email = useEmailPreview(body.email, values);
  const tabs: PreviewTab[] = [
    ...(body.whatsapp ? (["whatsapp"] as const) : []),
    ...(body.email ? (["email"] as const) : []),
    ...(body.teams ? (["teams"] as const) : []),
    "text",
  ];
  const [picked, setPicked] = useState<PreviewTab>(tabs[0]);
  const tab = tabs.includes(picked) ? picked : tabs[0];
  const label: Record<PreviewTab, string> = {
    whatsapp: tr("channelWhatsapp", d),
    email: tr("channelEmail", d),
    teams: tr("channelTeams", d),
    text: tr("previewTextTab", d),
  };
  return (
    <Panel title={tr("preview", d)}>
      <div
        role="tablist"
        aria-label={tr("preview", d)}
        className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-700"
      >
        {tabs.map((t) => {
          const Icon = t === "text" ? HiMenuAlt2 : channelLogo(t);
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${tab === t ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"}`}
              onClick={() => setPicked(t)}
            >
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {label[t]}
            </button>
          );
        })}
      </div>
      {tab === "whatsapp" && (
        <WhatsAppPhone text={body.baseText} values={values} meta={meta} d={d} />
      )}
      {tab === "email" && (
        <EmailPreview preview={email} to={values.nombre ?? "—"} d={d} />
      )}
      {tab === "teams" && body.teams && (
        <TeamsCardPreview card={body.teams} values={values} d={d} />
      )}
      {tab === "text" && (
        <>
          <PlainPreview text={chatText(body, values, email.data?.text)} d={d} />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("previewTextHint", d)}
          </p>
        </>
      )}
    </Panel>
  );
}
