package com.microboxlabs.miot.integrations.geocoding;

import java.math.BigDecimal;
import java.util.List;

/** Snapshot of the terms and audiences when a monthly level is claimed. */
public record GeocodingQuotaNotification(
        String organization, String organizationName, long organizationId, String tenantCode,
        String month, String level, long used, int quota, int usedPct, String onExhausted,
        boolean enforced, BigDecimal overagePriceUsd, String usagePath,
        List<String> platformEmails, List<String> adminEmails,
        List<String> platformWhatsAppRecipients, List<String> orgWhatsAppRecipients) {

    public static final String JOB_TYPE = "geocoding_quota_notification";
    public static final String THRESHOLD = "threshold";
    public static final String EXHAUSTED = "exhausted";
    public static final String TEMPLATE_NAME = "miot_geocoding_quota_alert";
    public static final String TEMPLATE_LANGUAGE = "es";
    public static final String TEMPLATE_BODY = "Geocodificación de {{organization}}: {{used}} / {{quota}} llamadas "
            + "({{pct}}%). {{next_step}} Revisa el consumo en /app/es/users/settings/geocoding.";

    public String idempotencyKey() {
        return "geocoding-quota:" + organization + ":" + month + ":" + level;
    }
}
