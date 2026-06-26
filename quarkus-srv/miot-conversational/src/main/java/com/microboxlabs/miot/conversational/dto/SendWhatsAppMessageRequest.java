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
        String taskId) {

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
