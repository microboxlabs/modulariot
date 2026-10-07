"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { ApiError, getJson, sendEmpty, sendJson } from "../data/json-client";
import {
  templateUrl,
  type MailTemplate,
  type MailTemplatePreview,
  type SaveMailTemplate,
  type TemplateLang,
  type TemplateScope,
} from "./mail-template-model";

/** One invitation template, with save, reset and preview. */
export function useMailTemplate(scope: TemplateScope, lang: TemplateLang) {
  const url = templateUrl(scope, lang);
  const { data, error, isLoading, mutate } = useSWR<MailTemplate, ApiError>(
    ["mail-template", scope, lang],
    () => getJson<MailTemplate>(url),
    { revalidateOnFocus: false }
  );

  const save = async (value: SaveMailTemplate) => {
    const saved = await sendJson<MailTemplate>("PUT", url, value);
    await mutate(saved, { revalidate: false });
  };

  const reset = async () => {
    await sendEmpty("DELETE", url);
    await mutate();
  };

  // Stable, so the editor can re-render a preview only when the text changes.
  const preview = useCallback(
    (value: SaveMailTemplate) =>
      sendJson<MailTemplatePreview>("POST", `${url}/preview`, value),
    [url]
  );

  return {
    template: data ?? null,
    isLoading,
    error: error ?? null,
    save,
    reset,
    preview,
  };
}
