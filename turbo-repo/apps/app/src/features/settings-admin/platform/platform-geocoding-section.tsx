"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Checkbox,
  Label,
  Select,
  Spinner,
  TextInput,
} from "flowbite-react";
import { HiOutlineGlobeAlt } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  PlatformSettingButtons,
  PlatformSettingRemoveModal,
  usePlatformSettingActions,
} from "./platform-setting-controls";
import {
  geocodingDraftFrom,
  toGeocodingRequest,
  type GeocodingDraft,
} from "./platform-geocoding-form";
import {
  usePlatformGeocoding,
  type GeocodingProviderName,
} from "./use-platform-geocoding";

interface PlatformGeocodingSectionProps {
  readonly dict: I18nRecord;
}

const PROVIDERS: readonly { id: GeocodingProviderName; label: string }[] = [
  { id: "mapbox", label: "Mapbox" },
  { id: "google", label: "Google" },
];

/**
 * The geocoding provider the platform contracts and pays for. Every
 * organization uses it within its plan's quota; the cost per call is the
 * platform's, recorded in each usage row.
 */
export default function PlatformGeocodingSection({
  dict,
}: Readonly<PlatformGeocodingSectionProps>) {
  const { provider, isLoading, error, save, remove } = usePlatformGeocoding();
  const [draft, setDraft] = useState<GeocodingDraft>({
    provider: "mapbox",
    token: "",
    permanent: true,
    cost: "",
  });
  const { busy, confirmRemove, setConfirmRemove, submit, confirmRemoval } =
    usePlatformSettingActions(dict, { save, remove });

  useEffect(() => {
    if (provider) setDraft(geocodingDraftFrom(provider));
  }, [provider]);

  const configured = provider?.configured ?? false;
  const set = (patch: Partial<GeocodingDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const onSave = () => {
    const result = toGeocodingRequest(draft, configured);
    if (!result.ok) {
      toast.error(trDynamic(result.error, dict));
      return;
    }
    submit(result.value, () => set({ token: "" }));
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HiOutlineGlobeAlt className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
        </div>
        {provider && (
          <Badge color={configured ? "success" : "gray"}>
            {configured ? tr("statusConfigured", dict) : tr("statusNone", dict)}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {provider && (
        <div className="mt-4 flex max-w-xl flex-col gap-4">
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
                set({ provider: e.target.value as GeocodingProviderName })
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
            <Label htmlFor="platform-geocoding-token">
              {tr("token", dict)}
            </Label>
            <TextInput
              id="platform-geocoding-token"
              type="password"
              sizing="sm"
              autoComplete="off"
              placeholder={
                provider.tokenPreview
                  ? tr("tokenKeep", dict, { preview: provider.tokenPreview })
                  : ""
              }
              value={draft.token}
              disabled={busy}
              onChange={(e) => set({ token: e.target.value })}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("tokenHint", dict)}
            </span>
          </div>
          {draft.provider === "mapbox" && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="platform-geocoding-permanent"
                  checked={draft.permanent}
                  disabled={busy}
                  onChange={(e) => set({ permanent: e.target.checked })}
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
              onChange={(e) => set({ cost: e.target.value })}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("costHelp", dict)}
            </span>
          </div>
          <PlatformSettingButtons
            dict={dict}
            busy={busy}
            canSave={configured || draft.token.trim() !== ""}
            configured={configured}
            onSave={onSave}
            onRemove={() => setConfirmRemove(true)}
          />
        </div>
      )}

      <PlatformSettingRemoveModal
        dict={dict}
        isOpen={confirmRemove}
        busy={busy}
        onClose={() => setConfirmRemove(false)}
        onConfirm={confirmRemoval}
      />
    </section>
  );
}
