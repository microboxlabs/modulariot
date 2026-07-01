package com.microboxlabs.miot.conversational.service;

import java.util.Map;

/**
 * Renders the human-readable body of an outbound WhatsApp <em>template</em> message from its name and
 * NAMED parameters, so the Conversations panel can show the real text the driver received instead of
 * just the template id (e.g. "pod_rejected_v1").
 *
 * <p>Meta stores the approved template copy on the WABA, not here; this registry mirrors that copy
 * (es_CL) so the pool has a faithful, self-contained rendering. The copy is the source-of-truth spec
 * in {@code .cursor/plans/whatsapp-integration/whatsapp-templates.md}. If a template is unknown, we
 * return {@code null} and the caller falls back to the template name — no guessing.
 *
 * <p>Placeholders are {@code {{param_name}}} (named, matching the send parameters). Any placeholder
 * left unfilled (a missing param) is stripped rather than shown raw.
 */
public final class WhatsAppTemplateRenderer {

    private static final String FOOTER_TRANSPORT = "ModularIoT · Coordinación de transporte";

    /** template name -> body copy with {{named}} placeholders (footer appended, as WhatsApp shows it). */
    private static final Map<String, String> BODIES = Map.of(
            "pod_rejected_v1",
            "Hola {{driver_name}}. Tu comprobante del viaje {{trip_reference}} no pudo ser aceptado: "
                    + "{{reason}}. Por favor envía una nueva foto del documento para poder continuar. Gracias."
                    + "\n\n" + FOOTER_TRANSPORT,
            "pod_approved_v1",
            "Hola {{driver_name}}. Tu comprobante de entrega del viaje {{trip_reference}} fue validado "
                    + "correctamente. ¡Gracias! El viaje queda cerrado."
                    + "\n\n" + FOOTER_TRANSPORT,
            "pod_image_unclear_v1",
            "Hola {{driver_name}}. Recibimos tu documento del viaje {{trip_reference}}, pero la imagen no "
                    + "se ve con claridad. Por favor envía una nueva foto, bien iluminada y enfocada, donde se "
                    + "lea la firma. Gracias."
                    + "\n\n" + FOOTER_TRANSPORT,
            "trip_detention_alert_v1",
            "Hola {{driver_name}}. Detectamos una detención no programada en el viaje {{trip_reference}}, "
                    + "cerca de {{location}}. ¿Está todo en orden? Por favor responde a este mensaje indicando "
                    + "el motivo o si necesitas apoyo."
                    + "\n\nModularIoT · Torre de Control",
            "trip_arrival_pod_request_v1",
            "Hola {{driver_name}}, tu viaje {{trip_reference}} ha sido confirmado como arribado por la torre "
                    + "de Control. Por favor, sube la prueba de entrega (POD) firmada respondiendo a este mensaje "
                    + "con la imagen o el documento.\n\nSi tienes dudas, responde a este mensaje y te ayudamos."
                    + "\n\nMicroBoxLabs · ModularIoT");

    private WhatsAppTemplateRenderer() {}

    /**
     * Fills {@code template}'s named placeholders with {@code params}. Returns {@code null} for an
     * unknown template so the caller can fall back to the template name.
     */
    public static String render(String templateName, Map<String, String> params) {
        if (templateName == null) {
            return null;
        }
        String body = BODIES.get(templateName);
        if (body == null) {
            return null;
        }
        Map<String, String> safeParams = params == null ? Map.of() : params;
        for (Map.Entry<String, String> param : safeParams.entrySet()) {
            String value = param.getValue() == null ? "" : param.getValue();
            body = body.replace("{{" + param.getKey() + "}}", value);
        }
        // Strip any placeholder a caller didn't supply, so we never render raw "{{reason}}".
        return body.replaceAll("\\{\\{[^}]+}}", "").trim();
    }
}
