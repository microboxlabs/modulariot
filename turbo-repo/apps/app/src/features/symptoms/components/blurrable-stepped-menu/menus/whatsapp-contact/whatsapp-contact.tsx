"use client";

import { useMemo, useState } from "react";
import { Button, Label, Select, TextInput } from "flowbite-react";
import { FaWhatsapp } from "react-icons/fa";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  TreatmentsGeneralResponseItem,
  TreatmentsTripInfoResponse,
} from "@/app/api/treatments/general/route.type";
import { ShowNotification } from "@/features/notifications/notification";
import {
  WHATSAPP_TEMPLATES,
  renderTemplateBody,
  type WhatsAppTemplate,
} from "@/features/whatsapp/whatsapp-templates";
import { sendWhatsAppMessage } from "@/features/whatsapp/send-data-service";

/** Strip spaces / dashes / parens so a displayed phone is closer to E.164. */
function normalizePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, "");
}

function prefillParams(
  template: WhatsAppTemplate,
  trip: TreatmentsTripInfoResponse | undefined,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const name of template.params) {
    if (name === "driver_name") params[name] = trip?.driver ?? "";
    else if (name === "trip_reference") params[name] = trip?.trip_id ?? "";
    else params[name] = "";
  }
  return params;
}

export default function WhatsAppContact({
  dict,
  treatmentData,
  setIsMenuOpen,
}: {
  readonly dict: I18nRecord;
  readonly treatmentData: TreatmentsGeneralResponseItem | null;
  readonly setIsMenuOpen: (isMenuOpen: boolean) => void;
}) {
  const t = dict.symptoms as I18nRecord;
  const trip = treatmentData?.trip_info;

  const [templateName, setTemplateName] = useState(WHATSAPP_TEMPLATES[0].name);
  const [params, setParams] = useState<Record<string, string>>(() =>
    prefillParams(WHATSAPP_TEMPLATES[0], trip),
  );
  const [recipient, setRecipient] = useState(normalizePhone(trip?.driver_contact ?? ""));
  const [sending, setSending] = useState(false);

  const template = useMemo(
    () => WHATSAPP_TEMPLATES.find((x) => x.name === templateName) ?? WHATSAPP_TEMPLATES[0],
    [templateName],
  );

  const onTemplateChange = (name: string) => {
    const next = WHATSAPP_TEMPLATES.find((x) => x.name === name) ?? WHATSAPP_TEMPLATES[0];
    setTemplateName(name);
    setParams(prefillParams(next, trip));
  };

  const paramLabel = (name: string) =>
    (t[`whatsapp_param_${name}`] as string | undefined) ?? name;

  const canSend =
    recipient.trim().length > 0 && template.params.every((p) => params[p]?.trim());

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      // Trim so the sent payload matches the (trimmed) live preview.
      const trimmedParams = Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, value.trim()]),
      );
      await sendWhatsAppMessage({
        to: recipient.trim(),
        type: "TEMPLATE",
        templateName: template.name,
        language: template.language,
        templateParams: trimmedParams,
        serviceCode: trip?.trip_id || undefined,
      });
      ShowNotification({ type: "success", message: t.whatsapp_success as string });
      setIsMenuOpen(false);
    } catch (err) {
      ShowNotification({
        type: "error",
        message: err instanceof Error ? err.message : (t.whatsapp_error as string),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col gap-3">
      <div className="w-full flex flex-row flex-wrap gap-x-6 gap-y-1">
        <InfoLine label={t.driver_name as string} value={trip?.driver} />
        <InfoLine label={t.vehicle_plate as string} value={trip?.asset_id} />
        <InfoLine label={t.phone as string} value={trip?.driver_contact} />
      </div>
      <hr className="w-full border-gray-200 dark:border-gray-700" />

      <div>
        <Label htmlFor="wa-template" className="mb-1 block">
          {t.whatsapp_template as string}
        </Label>
        <Select
          id="wa-template"
          value={templateName}
          onChange={(e) => onTemplateChange(e.target.value)}
        >
          {WHATSAPP_TEMPLATES.map((tpl) => (
            <option key={tpl.name} value={tpl.name}>
              {tpl.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="wa-recipient" className="mb-1 block">
          {t.whatsapp_recipient as string}
        </Label>
        <TextInput
          id="wa-recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {template.params.map((p) => (
          <div key={p}>
            <Label htmlFor={`wa-param-${p}`} className="mb-1 block">
              {paramLabel(p)}
            </Label>
            <TextInput
              id={`wa-param-${p}`}
              value={params[p] ?? ""}
              onChange={(e) => setParams({ ...params, [p]: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div>
        <Label className="mb-1 block">{t.whatsapp_preview as string}</Label>
        <div className="whitespace-pre-wrap rounded-md bg-green-50 p-3 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-100">
          {renderTemplateBody(template, params)}
        </div>
      </div>

      <Button
        color="success"
        className="mt-1"
        disabled={!canSend || sending}
        onClick={handleSend}
      >
        <FaWhatsapp className="mr-2 h-5 w-5" />
        {sending ? (t.whatsapp_sending as string) : (t.whatsapp_send as string)}
      </Button>
    </div>
  );
}

function InfoLine({ label, value }: { readonly label: string; readonly value?: string }) {
  return (
    <p className="text-xs font-light text-gray-900 dark:text-gray-200">
      {label}:{" "}
      <span className="font-light text-gray-500 dark:text-gray-400">{value ?? "—"}</span>
    </p>
  );
}
