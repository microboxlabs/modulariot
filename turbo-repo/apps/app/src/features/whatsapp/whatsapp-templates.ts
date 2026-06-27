/**
 * Approved WhatsApp template catalog (manual-first demo). All templates are `es_CL`
 * with NAMED parameters; the bodies mirror the approved WABA copy so the Control Tower
 * can preview exactly what the driver receives. Keep in sync with the WABA — adding a
 * template here that is not approved will fail at send time (Meta error 132001).
 */
export interface WhatsAppTemplate {
  /** Exact WABA template name. */
  readonly name: string;
  /** Operator-facing label (Spanish, the operational language). */
  readonly label: string;
  readonly language: string;
  /** NAMED parameter keys, in display order. */
  readonly params: readonly string[];
  /** Body copy with {{param}} placeholders — for preview only. */
  readonly body: string;
}

export const WHATSAPP_LANGUAGE = "es_CL";

export const WHATSAPP_TEMPLATES: readonly WhatsAppTemplate[] = [
  {
    name: "trip_detention_alert_v1",
    label: "Alerta de detención",
    language: WHATSAPP_LANGUAGE,
    params: ["driver_name", "trip_reference", "location"],
    body:
      "Hola {{driver_name}}. Detectamos una detención no programada en el viaje " +
      "{{trip_reference}}, cerca de {{location}}. ¿Está todo en orden? Por favor responde " +
      "a este mensaje indicando el motivo o si necesitas apoyo.",
  },
  {
    name: "trip_arrival_pod_request_v1",
    label: "Solicitud de POD (arribo)",
    language: WHATSAPP_LANGUAGE,
    params: ["driver_name", "trip_reference"],
    body:
      "Hola {{driver_name}}, tu viaje {{trip_reference}} ha sido confirmado como arribado " +
      "por la torre de Control. Por favor, sube la prueba de entrega (POD) firmada " +
      "respondiendo a este mensaje con la imagen o el documento.",
  },
  {
    name: "pod_image_unclear_v1",
    label: "POD ilegible — reenviar",
    language: WHATSAPP_LANGUAGE,
    params: ["driver_name", "trip_reference"],
    body:
      "Hola {{driver_name}}. Recibimos tu documento del viaje {{trip_reference}}, pero la " +
      "imagen no se ve con claridad. Por favor envía una nueva foto, bien iluminada y " +
      "enfocada, donde se lea la firma. Gracias.",
  },
  {
    name: "pod_approved_v1",
    label: "POD aprobado",
    language: WHATSAPP_LANGUAGE,
    params: ["driver_name", "trip_reference"],
    body:
      "Hola {{driver_name}}. Tu comprobante de entrega del viaje {{trip_reference}} fue " +
      "validado correctamente. ¡Gracias! El viaje queda cerrado.",
  },
  {
    name: "pod_rejected_v1",
    label: "POD rechazado",
    language: WHATSAPP_LANGUAGE,
    params: ["driver_name", "trip_reference", "reason"],
    body:
      "Hola {{driver_name}}. Tu comprobante del viaje {{trip_reference}} no pudo ser " +
      "aceptado: {{reason}}. Por favor envía una nueva foto del documento para poder " +
      "continuar. Gracias.",
  },
];

/** Renders a template body, substituting filled params and leaving {{placeholders}} for empties. */
export function renderTemplateBody(
  template: WhatsAppTemplate,
  params: Record<string, string>,
): string {
  return template.params.reduce((text, name) => {
    const value = params[name]?.trim();
    return value ? text.split(`{{${name}}}`).join(value) : text;
  }, template.body);
}
