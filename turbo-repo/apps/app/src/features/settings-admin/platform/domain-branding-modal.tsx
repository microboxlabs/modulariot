"use client";

import { useEffect, useRef, useState } from "react";
import { TextInput, ToggleSwitch } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import { normalizeDomain } from "@/features/branding/domain-name";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  checkHomeUrl,
  checkLogoFile,
  LOGO_ACCEPT,
  MAX_LOGO_BYTES,
  readLogoDataUrl,
  type HomeUrlProblem,
  type LogoProblem,
} from "./domain-branding-form";
import LogoPreview from "./logo-preview";
import { domainLogoUrl, fetchStoredLogoDataUrl } from "./platform-data-service";
import type { DomainBrandingAdmin, SetDomainBranding } from "./platform.types";

const FILE_INPUT_CLASS =
  "block w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 file:mr-4 file:cursor-pointer file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:file:bg-gray-600 dark:file:text-gray-100";

type LogoGround = "light" | "dark";

const LOGO_PROBLEM_KEYS: Record<LogoProblem, string> = {
  type: "modal.errors.logoType",
  empty: "modal.errors.logoEmpty",
  size: "modal.errors.logoSize",
};

const HOME_URL_PROBLEM_KEYS: Record<HomeUrlProblem, string> = {
  length: "modal.errors.homeUrlLength",
  malformed: "modal.errors.homeUrlMalformed",
  scheme: "modal.errors.homeUrlScheme",
  userInfo: "modal.errors.homeUrlUserInfo",
};

interface DomainBrandingModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (domain: string, value: SetDomainBranding) => void;
  /** null opens the form for a new domain; a row opens it for that domain. */
  readonly initial: DomainBrandingAdmin | null;
  readonly isSaving: boolean;
  readonly error: Error | null;
  readonly dict: I18nRecord;
}

export default function DomainBrandingModal({
  show,
  onClose,
  onSubmit,
  initial,
  isSaving,
  error,
  dict,
}: DomainBrandingModalProps) {
  const isEdit = initial != null;
  const [domain, setDomain] = useState("");
  const [homeUrl, setHomeUrl] = useState("");
  const [active, setActive] = useState(true);
  /** Set only when a new file has been picked; null means "keep the stored one". */
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [darkLogoDataUrl, setDarkLogoDataUrl] = useState<string | null>(null);
  /** Distinct from "none picked": the operator asked for the variant to go. */
  const [darkLogoCleared, setDarkLogoCleared] = useState(false);
  const [problemKey, setProblemKey] = useState<string | null>(null);
  const wasOpen = useRef(false);
  /**
   * The newest read per ground, held as the promise rather than its result.
   *
   * Submitting is allowed while a file is still being read — Save is one click
   * away from the picker — so the bytes have to be awaited at submit time.
   * Keeping the promise also settles ordering: two quick picks resolve in any
   * order, and only the one still recorded here is accepted.
   */
  const latestRead = useRef<Record<LogoGround, Promise<string> | null>>({
    light: null,
    dark: null,
  });

  // Initialize on open (false → true) rather than on every render, so typing
  // is not overwritten when the parent re-renders mid-edit.
  useEffect(() => {
    if (show && !wasOpen.current) {
      setDomain(initial?.domain ?? "");
      setHomeUrl(initial?.homeUrl ?? "");
      setActive(initial?.active ?? true);
      setLogoDataUrl(null);
      setDarkLogoDataUrl(null);
      setDarkLogoCleared(false);
      setProblemKey(null);
      latestRead.current = { light: null, dark: null };
    }
    wasOpen.current = show;
  }, [show, initial]);

  const pickFile = (
    event: React.ChangeEvent<HTMLInputElement>,
    ground: LogoGround,
    accept: (dataUrl: string | null) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const problem = checkLogoFile(file);
    if (problem) {
      // Also forget the previous read: a rejected pick means the operator no
      // longer wants what they chose before it.
      latestRead.current[ground] = null;
      accept(null);
      setProblemKey(LOGO_PROBLEM_KEYS[problem]);
      return;
    }
    setProblemKey(null);

    const read = readLogoDataUrl(file);
    latestRead.current[ground] = read;
    read
      .then((dataUrl) => {
        if (latestRead.current[ground] === read) accept(dataUrl);
      })
      .catch(() => {
        if (latestRead.current[ground] === read) {
          setProblemKey("modal.errors.logoUnreadable");
        }
      });
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) =>
    pickFile(event, "light", setLogoDataUrl);

  const handleDarkFile = (event: React.ChangeEvent<HTMLInputElement>) =>
    pickFile(event, "dark", (dataUrl) => {
      setDarkLogoDataUrl(dataUrl);
      if (dataUrl) setDarkLogoCleared(false);
    });

  /** The bytes to send: a freshly picked file, else the stored logo re-read. */
  const resolveLogo = async (): Promise<string | null> => {
    const picked = latestRead.current.light;
    if (picked) return picked;
    if (!initial) return null;
    return fetchStoredLogoDataUrl(initial.domain, initial.logoEtag);
  };

  /**
   * Null when the domain should end up with no dark variant — either it never
   * had one, or the operator removed it. Otherwise the picked file, or the
   * stored one re-read, since the write replaces the whole row.
   */
  const resolveDarkLogo = async (): Promise<string | null> => {
    if (darkLogoCleared) return null;
    const picked = latestRead.current.dark;
    if (picked) return picked;
    if (!initial?.logoDarkEtag) return null;
    return fetchStoredLogoDataUrl(initial.domain, initial.logoDarkEtag, "dark");
  };

  const submit = async () => {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      setProblemKey("modal.errors.domain");
      return;
    }
    const urlProblem = checkHomeUrl(homeUrl);
    if (urlProblem) {
      setProblemKey(HOME_URL_PROBLEM_KEYS[urlProblem]);
      return;
    }

    let logo: string | null;
    let darkLogo: string | null;
    try {
      logo = await resolveLogo();
      darkLogo = await resolveDarkLogo();
    } catch {
      setProblemKey("modal.errors.logoUnreadable");
      return;
    }
    if (!logo) {
      setProblemKey("modal.errors.logoRequired");
      return;
    }

    setProblemKey(null);
    onSubmit(normalized, {
      logoDataUrl: logo,
      logoDarkDataUrl: darkLogo,
      homeUrl: homeUrl.trim() || null,
      active,
    });
  };

  const preview =
    logoDataUrl ?? (initial ? domainLogoUrl(initial.domain, initial.logoEtag) : null);
  const storedDarkPreview =
    !darkLogoCleared && initial?.logoDarkEtag
      ? domainLogoUrl(initial.domain, initial.logoDarkEtag, "dark")
      : null;
  const darkPreview = darkLogoDataUrl ?? storedDarkPreview;
  const hasDarkLogo = darkPreview != null;
  const problem = problemKey ? new Error(trDynamic(problemKey, dict)) : null;

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={isEdit ? tr("modal.editTitle", dict) : tr("modal.addTitle", dict)}
      subtitle={
        isEdit ? tr("modal.editSubtitle", dict) : tr("modal.subtitle", dict)
      }
      submitLabel={isSaving ? tr("modal.saving", dict) : tr("modal.save", dict)}
      cancelLabel={tr("modal.cancel", dict)}
      isProcessing={isSaving}
      error={problem ?? error}
      onSubmit={() => void submit()}
      size="2xl"
      showCancelButton
    >
      <div className="flex flex-col gap-4">
        <SettingsFormField id="branding-domain" label={tr("modal.domainLabel", dict)}>
          <TextInput
            id="branding-domain"
            value={domain}
            // The domain is the row's key: editing it here would create a
            // second row rather than rename this one.
            disabled={isEdit}
            placeholder={tr("modal.domainPlaceholder", dict)}
            onChange={(event) => setDomain(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.domainHelp", dict)}
          </p>
        </SettingsFormField>

        <SettingsFormField id="branding-logo" label={tr("modal.logoLabel", dict)}>
          <input
            id="branding-logo"
            type="file"
            accept={LOGO_ACCEPT}
            onChange={handleFile}
            className={FILE_INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.logoHelp", dict, {
              size: String(Math.round(MAX_LOGO_BYTES / 1024)),
            })}
          </p>
        </SettingsFormField>

        <SettingsFormField
          id="branding-logo-dark"
          label={tr("modal.darkLogoLabel", dict)}
        >
          <input
            id="branding-logo-dark"
            type="file"
            accept={LOGO_ACCEPT}
            onChange={handleDarkFile}
            className={FILE_INPUT_CLASS}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr("modal.darkLogoHelp", dict)}
            </p>
            {hasDarkLogo && (
              <button
                type="button"
                onClick={() => {
                  // Forget any read still running for this ground: its
                  // completion would otherwise re-accept the bytes and undo
                  // the removal, and Save would store the logo just removed.
                  latestRead.current.dark = null;
                  setDarkLogoDataUrl(null);
                  setDarkLogoCleared(true);
                }}
                className="text-xs font-medium text-red-600 underline hover:no-underline dark:text-red-400"
              >
                {tr("modal.removeDarkLogo", dict)}
              </button>
            )}
          </div>
        </SettingsFormField>

        {preview && (
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {logoDataUrl
                ? tr("modal.newLogo", dict)
                : tr("modal.currentLogo", dict)}
            </p>
            <LogoPreview
              lightLabel={tr("previewLight", dict)}
              darkLabel={tr("previewDark", dict)}
              light={
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview}
                  alt={tr("modal.previewAlt", dict)}
                  className="max-h-full max-w-full object-contain"
                />
              }
              dark={
                darkPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={darkPreview}
                    alt={tr("modal.darkPreviewAlt", dict)}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : undefined
              }
            />
            {!hasDarkLogo && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {tr("modal.sameOnBoth", dict)}
              </p>
            )}
          </div>
        )}

        <SettingsFormField
          id="branding-home-url"
          label={tr("modal.homeUrlLabel", dict)}
        >
          <TextInput
            id="branding-home-url"
            value={homeUrl}
            placeholder={tr("modal.homeUrlPlaceholder", dict)}
            onChange={(event) => setHomeUrl(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.homeUrlHelp", dict)}
          </p>
        </SettingsFormField>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <ToggleSwitch
            checked={active}
            label={tr("modal.activeLabel", dict)}
            onChange={setActive}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("modal.activeHelp", dict)}
          </p>
        </div>
      </div>
    </FormModal>
  );
}
