"use client";

import { Checkbox, Label, Select, TextInput } from "flowbite-react";
import { PLATFORM_SCOPE_SLUG } from "@/features/common/platform-scope";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import { useCredentials } from "@/features/credentials/use-credentials";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { GeocodingDraft } from "./platform-geocoding-form";
import type { GeocodingProviderName } from "./use-platform-geocoding";

interface PlatformGeocodingFieldsProps {
  /** `pages.userSettings.platform.geocoding` subtree. */
  readonly dict: I18nRecord;
  readonly draft: GeocodingDraft;
  readonly busy: boolean;
  readonly onChange: (patch: Partial<GeocodingDraft>) => void;
}

const PROVIDERS: readonly { id: GeocodingProviderName; label: string }[] = [
  { id: "mapbox", label: "Mapbox" },
  { id: "google", label: "Google" },
];

/** A bearer token of the platform scope; managed credentials have no secret of their own. */
function isPlainBearerToken(credential: CredentialListItem): boolean {
  const config = credential.config as Record<string, unknown>;
  return credential.typeId === "BEARER_TOKEN" && config.managed !== true;
}

/** Provider, credential, permanent mode and cost of the platform's geocoding provider. */
export default function PlatformGeocodingFields({
  dict,
  draft,
  busy,
  onChange,
}: Readonly<PlatformGeocodingFieldsProps>) {
  const { credentials, isLoading } = useCredentials(PLATFORM_SCOPE_SLUG);
  const tokens = credentials.filter(isPlainBearerToken);
  const credentialHint =
    tokens.length === 0
      ? tr("credentialNone", dict)
      : tr("credentialHelp", dict);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="platform-geocoding-provider">
          {tr("provider", dict)}
        </Label>
        <Select
          id="platform-geocoding-provider"
          sizing="sm"
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
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {trDynamic(draft.provider, dict.providerHelp as I18nRecord)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="platform-geocoding-credential">
          {tr("credential", dict)}
        </Label>
        <Select
          id="platform-geocoding-credential"
          sizing="sm"
          value={draft.credentialId}
          disabled={busy || isLoading}
          onChange={(e) => onChange({ credentialId: e.target.value })}
        >
          <option value="">{tr("credentialPick", dict)}</option>
          {tokens.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {credentialHint}
        </span>
      </div>
      {draft.provider === "mapbox" && (
        <div className="flex flex-col gap-1">
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
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tr("permanentHelp", dict)}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor="platform-geocoding-cost">{tr("cost", dict)}</Label>
        <TextInput
          id="platform-geocoding-cost"
          sizing="sm"
          inputMode="decimal"
          placeholder="0.005"
          value={draft.cost}
          disabled={busy}
          onChange={(e) => onChange({ cost: e.target.value })}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr("costHelp", dict)}
        </span>
      </div>
    </div>
  );
}
