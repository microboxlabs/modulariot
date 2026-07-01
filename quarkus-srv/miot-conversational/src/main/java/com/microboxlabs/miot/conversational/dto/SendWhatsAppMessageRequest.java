package com.microboxlabs.miot.conversational.dto;

import com.microboxlabs.miot.conversational.domain.MessageRole;
import java.util.Map;

/**
 * Request to send an outbound WhatsApp message. {@code type} selects {@code TEXT}
 * (free-form, only valid inside an open 24h session) or {@code TEMPLATE} (a pre-approved
 * template, valid to open a conversation). {@code templateParams} fills the template's
 * NAMED body placeholders (e.g. {@code {"driver_name": "...", "trip_reference": "..."}}).
 * The trip-context fields are optional and, when present, anchor the conversation to a
 * service/process so its history stays attributable.
 *
 * <p>{@code actor} names the human who triggered the send (e.g. the operator who
 * approved/rejected a POD in an upstream process). It is honoured only on the
 * service-to-service (M2M) send path, where the transport principal is a machine: the
 * message is then attributed to {@code actor} rather than the M2M client. The user-facing
 * send path ignores it and attributes to the authenticated user (no actor spoofing).
 */
public record SendWhatsAppMessageRequest(
        String to,
        String type,
        String body,
        String templateName,
        String language,
        Map<String, String> templateParams,
        MessageRole role,
        String driverId,
        String serviceCode,
        String processInstanceId,
        String taskId,
        String actor) {

    /**
     * Normalizes blank context/identity fields to {@code null} so they never reach persistence as
     * empty strings. Critical for {@code serviceCode}: per-service uniqueness treats {@code ""} as a
     * real value (NOT NULL), so a blank code would be indexed and collide across unrelated
     * blank-service sends, and would never match {@code findByTenantAndService} — distinct from
     * "unassigned" ({@code null}). Applies on every construction path (the pre-{@code actor}
     * constructor and Jackson both funnel through here).
     */
    public SendWhatsAppMessageRequest {
        driverId = blankToNull(driverId);
        serviceCode = blankToNull(serviceCode);
        processInstanceId = blankToNull(processInstanceId);
        taskId = blankToNull(taskId);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /**
     * Backward-compatible constructor (pre-{@code actor}). Keeps existing positional callers
     * working; {@code actor} defaults to {@code null} (the M2M path then attributes to the
     * calling principal). Jackson always binds the canonical (all-component) constructor.
     */
    public SendWhatsAppMessageRequest(
            String to,
            String type,
            String body,
            String templateName,
            String language,
            Map<String, String> templateParams,
            MessageRole role,
            String driverId,
            String serviceCode,
            String processInstanceId,
            String taskId) {
        this(to, type, body, templateName, language, templateParams, role,
                driverId, serviceCode, processInstanceId, taskId, null);
    }

    private static final String TYPE_TEMPLATE = "TEMPLATE";
    private static final String DEFAULT_LANGUAGE = "es_CL";

    public boolean isTemplate() {
        return TYPE_TEMPLATE.equalsIgnoreCase(type);
    }

    public String languageOrDefault() {
        return language == null || language.isBlank() ? DEFAULT_LANGUAGE : language;
    }

    public MessageRole roleOrDefault() {
        return role == null ? MessageRole.AGENT : role;
    }

    public Map<String, String> templateParamsOrEmpty() {
        return templateParams == null ? Map.of() : templateParams;
    }
}
