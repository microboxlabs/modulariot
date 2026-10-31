"use client";

import { useState } from "react";
import { Label, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { DEFAULT_STORAGE } from "../types/dashboard.types";
import {
  DashboardApiError,
  type createDashboardServerClient,
} from "../services/dashboard-server-client";

type Client = ReturnType<typeof createDashboardServerClient>;

/** The dashboard server's id for a name: lowercase ASCII letters, digits and hyphens, at most 80. */
export function serverDashboardSlug(name: string): string {
  return name
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .slice(0, 80)
    .replace(/-$/, "");
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
  client: Client;
  existingSlugs: readonly string[];
  dict: I18nRecord;
}

/** Asks for a name and creates the dashboard on the server under an id derived from it. */
export function ServerCreateDashboardModal({
  isOpen,
  onClose,
  onCreated,
  client,
  existingSlugs,
  dict,
}: Readonly<Props>) {
  const t = (key: string) => tr(`dashboard.create.${key}`, dict);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    setName("");
    setError(null);
    onClose();
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t("nameRequired"));
    const slug = serverDashboardSlug(trimmed);
    if (!slug) return setError(t("nameInvalid"));
    if (existingSlugs.includes(slug)) return setError(t("duplicateSlug"));
    setSaving(true);
    setError(null);
    try {
      await client.save(slug, { ...DEFAULT_STORAGE, name: trimmed }, '"0"');
      setName("");
      onCreated(slug);
    } catch (e) {
      const status = e instanceof DashboardApiError ? e.status : 0;
      setError(
        t(
          status === 409 || status === 412
            ? "duplicateSlug"
            : "errorNotification"
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={close}
      title={t("title")}
      subtitle={t("subtitle")}
      submitLabel={t("submit")}
      isProcessing={saving}
      onSubmit={() => void submit()}
      size="md"
    >
      <div>
        <Label htmlFor="server-dashboard-name">{t("nameLabel")}</Label>
        <TextInput
          id="server-dashboard-name"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          color={error ? "failure" : undefined}
          disabled={saving}
        />
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </FormModal>
  );
}
