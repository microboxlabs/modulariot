"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { BsStars } from "react-icons/bs";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { describeRule } from "./maintainer-api";

const DEBOUNCE_MS = 700;
const TAGS = new Set(["b", "i", "mark"]);

/**
 * The description as React elements. Only b, i and mark are kept; any
 * other markup is shown as text, so nothing from the response is injected
 * as HTML.
 */
export function renderDescription(html: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /<(b|i|mark)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let key = 0;
  for (const m of html.matchAll(pattern)) {
    if (m.index > last)
      out.push(
        <Fragment key={key++}>{decode(html.slice(last, m.index))}</Fragment>
      );
    const tag = m[1];
    const text = decode(m[2]);
    if (!TAGS.has(tag)) continue;
    if (tag === "b") out.push(<b key={key++}>{text}</b>);
    else if (tag === "i") out.push(<i key={key++}>{text}</i>);
    else
      out.push(
        <mark
          key={key++}
          className="rounded bg-yellow-100 px-0.5 dark:bg-yellow-900/40 dark:text-yellow-100"
        >
          {text}
        </mark>
      );
    last = m.index + m[0].length;
  }
  if (last < html.length)
    out.push(<Fragment key={key++}>{decode(html.slice(last))}</Fragment>);
  return out;
}

function decode(text: string) {
  return text
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

/**
 * The ✦ button of a section and, when open, what the rule does in plain
 * words. The Harness writes it once per distinct rule; the modulith caches
 * it, so reopening or undoing an edit does not call it again.
 */
export function RuleDescriptionToggle({
  open,
  onToggle,
  d,
}: Readonly<{ open: boolean; onToggle: () => void; d: I18nRecord }>) {
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={tr("describe", d)}
      title={tr("describe", d)}
      onClick={onToggle}
      className={`flex h-6 w-6 items-center justify-center rounded-md ${open ? "bg-violet-600 text-white" : "text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/30"}`}
    >
      <BsStars className="h-3.5 w-3.5" />
    </button>
  );
}

export default function RuleDescription({
  section,
  rule,
  sourceKey,
  d,
}: Readonly<{
  section: string;
  rule: string;
  sourceKey: string | null;
  d: I18nRecord;
}>) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!rule.trim() || !sourceKey) {
      setHtml(null);
      return;
    }
    // The old text describes the old rule; show "writing" until the new one arrives.
    setHtml(null);
    setFailed(false);
    let cancelled = false;
    const timer = setTimeout(() => {
      describeRule({ section, rule, sourceKey, locale: "es-CL" })
        .then((r) => {
          if (!cancelled) {
            setHtml(r.html);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [section, rule, sourceKey]);

  let body: ReactNode;
  if (failed)
    body = <span className="text-gray-500">{tr("describeFailed", d)}</span>;
  else if (html === null)
    body = <span className="text-gray-400">{tr("describing", d)}</span>;
  else body = renderDescription(html);

  return (
    <p
      className="flex gap-2 rounded-md bg-violet-50 px-3 py-2 text-sm text-gray-800 dark:bg-violet-900/20 dark:text-gray-100"
      aria-live="polite"
    >
      <BsStars
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400"
        aria-hidden
      />
      <span>{body}</span>
    </p>
  );
}
