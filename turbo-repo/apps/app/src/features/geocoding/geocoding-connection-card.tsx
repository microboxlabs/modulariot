"use client";

import { HiOutlineGlobeAlt } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  ChannelCard,
  type ChannelPartProps,
} from "@/features/settings-admin/channels/channel-card";
import { GeocodingConnectionModal } from "./geocoding-connection-modal";
import {
  GEOCODING_PROVIDER,
  geocodingCreate,
  geocodingIntegrationsBase,
  geocodingProviderOf,
  geocodingToForm,
  geocodingUpdate,
} from "./geocoding-connection";

const PROVIDER_NAMES = { mapbox: "Mapbox", google: "Google" } as const;

/**
 * The organization's geocoding provider. Without one, the platform's connection
 * is used, if there is one. The modulith has no test for this provider yet.
 */
export default function GeocodingConnectionCard({
  orgSlug,
  dict,
}: Readonly<{ orgSlug: string | null; dict: I18nRecord }>) {
  return (
    <ChannelCard
      orgSlug={orgSlug}
      provider={GEOCODING_PROVIDER}
      dict={dict}
      icon={<HiOutlineGlobeAlt className="h-5 w-5 text-gray-500" />}
      toCreate={geocodingCreate}
      toUpdate={geocodingUpdate}
      toForm={geocodingToForm}
      Detail={GeocodingDetail}
      Modal={GeocodingConnectionModal}
      modalProps={{ dict }}
      integrationsBase={geocodingIntegrationsBase}
      testable={false}
    />
  );
}

function GeocodingDetail({ connection, dict }: Readonly<ChannelPartProps>) {
  const provider = geocodingProviderOf(connection);
  const cost = connection.metadata?.costPerRequestUsd;
  return (
    <>
      <span className="font-medium">{tr("providerLabel", dict)}:</span>{" "}
      {PROVIDER_NAMES[provider]}
      {cost !== undefined && cost !== null && (
        <> · {tr("costLabel", dict, { cost: String(cost) })}</>
      )}
    </>
  );
}
