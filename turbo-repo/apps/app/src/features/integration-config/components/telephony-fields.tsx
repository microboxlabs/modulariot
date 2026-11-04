"use client";

import { TextInput } from "flowbite-react";
import type { UseFormRegister } from "react-hook-form";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import type { ConnectionFormData } from "../integration-config.types";
import type { TelephonyProvider } from "../telephony-connection";

/** The non-secret values of a TELNYX or TEAMS_PHONE connection. */
export function TelephonyFields({
  provider,
  register,
  dict,
  connectionId,
}: Readonly<{
  provider: TelephonyProvider;
  register: UseFormRegister<ConnectionFormData>;
  dict: I18nRecord;
  /** The saved connection, whose webhook URL is shown; absent while creating. */
  connectionId?: string;
}>) {
  if (provider === "TEAMS_PHONE") {
    return (
      <SettingsFormField
        id="connection-default-caller-id"
        label={tr("telephony.defaultCallerId", dict)}
      >
        <TextInput
          id="connection-default-caller-id"
          className="font-mono [&_input]:text-sm"
          placeholder="+56 9 0000 0000"
          {...register("defaultCallerId")}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("telephony.defaultCallerIdHelp", dict)}
        </p>
      </SettingsFormField>
    );
  }
  return (
    <>
      <SettingsFormField
        id="connection-sip-connection-id"
        label={tr("telephony.sipConnectionId", dict)}
      >
        <TextInput
          id="connection-sip-connection-id"
          className="font-mono [&_input]:text-sm"
          {...register("sipConnectionId")}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("telephony.sipConnectionIdHelp", dict)}
        </p>
      </SettingsFormField>
      <SettingsFormField
        id="connection-caller-number"
        label={tr("telephony.callerNumber", dict)}
      >
        <TextInput
          id="connection-caller-number"
          className="font-mono [&_input]:text-sm"
          placeholder="+56 9 0000 0000"
          {...register("callerNumber")}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("telephony.callerNumberHelp", dict)}
        </p>
      </SettingsFormField>
      <SettingsFormField
        id="connection-channel-limit"
        label={tr("telephony.channelLimit", dict)}
      >
        <TextInput
          id="connection-channel-limit"
          inputMode="numeric"
          placeholder="10"
          {...register("channelLimit")}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("telephony.channelLimitHelp", dict)}
        </p>
      </SettingsFormField>
      <SettingsFormField
        id="connection-webhook-public-key"
        label={tr("telephony.webhookPublicKey", dict)}
      >
        <TextInput
          id="connection-webhook-public-key"
          className="font-mono [&_input]:text-sm"
          {...register("webhookPublicKey")}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("telephony.webhookPublicKeyHelp", dict)}
        </p>
      </SettingsFormField>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {tr("telephony.webhookUrl", dict)}
        </p>
        <code className="mt-1 block break-all rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
          {`https://<modulith>/webhooks/telnyx/${connectionId ?? "<id>"}`}
        </code>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("telephony.webhookUrlHelp", dict)}
        </p>
      </div>
    </>
  );
}
