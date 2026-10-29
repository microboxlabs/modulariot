"use client";

import { Checkbox, Label, Select, TextInput } from "flowbite-react";
import { PLATFORM_SCOPE_SLUG } from "@/features/common/platform-scope";
import type {
  CredentialListItem,
  CredentialTypeId,
} from "@/features/credentials/credential.types";
import { useCredentials } from "@/features/credentials/use-credentials";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import type { GeocodingDraft } from "./platform-geocoding-form";
import type { GeocodingProviderName } from "./use-platform-geocoding";

interface PlatformGeocodingFieldsProps {
  /** `pages.userSettings.platform.geocoding` subtree. */
  readonly dict: I18nRecord;
  readonly draft: GeocodingDraft;
  readonly busy: boolean;
  /** Small inputs, for the settings section; the modal uses the regular size. */
  readonly compact?: boolean;
  readonly onChange: (patch: Partial<GeocodingDraft>) => void;
}

const PROVIDERS: readonly { id: GeocodingProviderName; label: string }[] = [
  { id: "mapbox", label: "Mapbox" },
  { id: "google", label: "Google" },
];

const PROVIDER_CREDENTIAL: Record<GeocodingProviderName, CredentialTypeId> = {
  mapbox: "MAPBOX",
  google: "GOOGLE_MAPS",
};

const HINT = "mt-1 text-xs text-gray-500 dark:text-gray-400";

/**
 * The provider's own credential type, or a plain bearer token. Managed
 * credentials have no secret of their own.
 */
function fitsProvider(
  credential: CredentialListItem,
  provider: GeocodingProviderName
): boolean {
  const config = credential.config as Record<string, unknown>;
  if (config.managed === true) return false;
  return (
    credential.typeId === PROVIDER_CREDENTIAL[provider] ||
    credential.typeId === "BEARER_TOKEN"
  );
}

/** Provider, credential, permanent mode and cost of the platform's geocoding provider. */
export default function PlatformGeocodingFields({
  dict,
  draft,
  busy,
  compact = false,
  onChange,
}: Readonly<PlatformGeocodingFieldsProps>) {
  const { credentials, isLoading } = useCredentials(PLATFORM_SCOPE_SLUG);
  const tokens = credentials.filter((c) => fitsProvider(c, draft.provider));
  const credentialHint =
    tokens.length === 0
      ? tr("credentialNone", dict)
      : tr("credentialHelp", dict);
  const sizing = compact ? "sm" : undefined;

  return (
    <div className="flex flex-col gap-4">
      <SettingsFormField
        id="platform-geocoding-provider"
        label={tr("provider", dict)}
      >
        <Select
          id="platform-geocoding-provider"
          sizing={sizing}
          value={draft.provider}
          disabled={busy}
          onChange={(e) =>
            onChange({ provider: e.target.value as GeocodingProviderName })
          }
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
        <p className={HINT}>
          {trDynamic(draft.provider, dict.providerHelp as I18nRecord)}
        </p>
      </SettingsFormField>
      <SettingsFormField
        id="platform-geocoding-credential"
        label={tr("credential", dict)}
      >
        <Select
          id="platform-geocoding-credential"
          sizing={sizing}
          value={draft.credentialId}
          disabled={busy || isLoading}
          onChange={(e) => onChange({ credentialId: e.target.value })}
        >
          <option value="">{tr("credentialPick", dict)}</option>
          {tokens.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.environment}
            </option>
          ))}
        </Select>
        <p className={HINT}>{credentialHint}</p>
      </SettingsFormField>
      {draft.provider === "mapbox" && (
        <div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="platform-geocoding-permanent"
              checked={draft.permanent}
              disabled={busy}
              onChange={(e) => onChange({ permanent: e.target.checked })}
            />
            <Label htmlFor="platform-geocoding-permanent">
              {tr("permanent", dict)}
            </Label>
          </div>
          <p className={HINT}>{tr("permanentHelp", dict)}</p>
        </div>
      )}
      <SettingsFormField id="platform-geocoding-cost" label={tr("cost", dict)}>
        <TextInput
          id="platform-geocoding-cost"
          sizing={sizing}
          inputMode="decimal"
          placeholder="0.005"
          value={draft.cost}
          disabled={busy}
          onChange={(e) => onChange({ cost: e.target.value })}
        />
        <p className={HINT}>{tr("costHelp", dict)}</p>
      </SettingsFormField>
    </div>
  );
}
