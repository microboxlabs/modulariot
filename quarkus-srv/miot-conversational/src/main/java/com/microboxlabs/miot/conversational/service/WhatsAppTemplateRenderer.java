package com.microboxlabs.miot.conversational.service;

import java.util.Map;
import java.util.regex.Pattern;

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

    // Possessive quantifier ([^}]*+) — no backtracking, so this is safe to run over the rendered body
    // (which carries caller-supplied param values). Precompiled once.
    private static final Pattern UNFILLED_PLACEHOLDER = Pattern.compile("\\{\\{[^}]*+}}");

    private static final String POD_REJECTED_V1 =
            """
            Hola {{driver_name}}. Tu comprobante del viaje {{trip_reference}} no pudo ser aceptado: {{reason}}. Por favor envía una nueva foto del documento para poder continuar. Gracias.

            ModularIoT · Coordinación de transporte""";

    private static final String POD_APPROVED_V1 =
            """
            Hola {{driver_name}}. Tu comprobante de entrega del viaje {{trip_reference}} fue validado correctamente. ¡Gracias! El viaje queda cerrado.

            ModularIoT · Coordinación de transporte""";

    private static final String POD_IMAGE_UNCLEAR_V1 =
            """
            Hola {{driver_name}}. Recibimos tu documento del viaje {{trip_reference}}, pero la imagen no se ve con claridad. Por favor envía una nueva foto, bien iluminada y enfocada, donde se lea la firma. Gracias.

            ModularIoT · Coordinación de transporte""";

    private static final String TRIP_DETENTION_ALERT_V1 =
            """
            Hola {{driver_name}}. Detectamos una detención no programada en el viaje {{trip_reference}}, cerca de {{location}}. ¿Está todo en orden? Por favor responde a este mensaje indicando el motivo o si necesitas apoyo.

            ModularIoT · Torre de Control""";

    private static final String TRIP_ARRIVAL_POD_REQUEST_V1 =
            """
            Hola {{driver_name}}, tu viaje {{trip_reference}} ha sido confirmado como arribado por la torre de Control. Por favor, sube la prueba de entrega (POD) firmada respondiendo a este mensaje con la imagen o el documento.

            Si tienes dudas, responde a este mensaje y te ayudamos.

            MicroBoxLabs · ModularIoT""";

    /** template name -> body copy with {{named}} placeholders (footer included, as WhatsApp shows it). */
    private static final Map<String, String> BODIES = Map.of(
            "pod_rejected_v1", POD_REJECTED_V1,
            "pod_approved_v1", POD_APPROVED_V1,
            "pod_image_unclear_v1", POD_IMAGE_UNCLEAR_V1,
            "trip_detention_alert_v1", TRIP_DETENTION_ALERT_V1,
            "trip_arrival_pod_request_v1", TRIP_ARRIVAL_POD_REQUEST_V1);

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
        return UNFILLED_PLACEHOLDER.matcher(body).replaceAll("").trim();
    }
}
