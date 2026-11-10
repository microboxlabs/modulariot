package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import org.jboss.logging.Logger;

/** Recovers missing hangup webhooks using a saved WhatsApp leg, without creating another ledger row. */
@ApplicationScoped
public class WhatsAppUsageRecovery {
    private static final Logger LOG = Logger.getLogger(WhatsAppUsageRecovery.class);
    private final TelephonyUsageStore usage;
    private final WhatsAppCallStore calls;
    private final WhatsAppSipConfig config;
    private final TelnyxClient client;
    private final ObjectMapper json;

    @Inject
    public WhatsAppUsageRecovery(TelephonyUsageStore usage, WhatsAppCallStore calls, WhatsAppSipConfig config,
            TelnyxClient client, ObjectMapper json) {
        this.usage = usage;
        this.calls = calls;
        this.config = config;
        this.client = client;
        this.json = json;
    }

    public int recover(String connectionId, String apiKey, Instant now) {
        if (!config.enabled()) return 0;
        Instant since = now.minusSeconds(3 * 86400L);
        int recovered = 0;
        for (String tenant : usage.tenants(since, now)) {
            for (UsageRow row : usage.rows(tenant, since, now)) {
                if (!connectionId.equals(row.connectionId()) || !UsageRow.WHATSAPP_CALL.equals(row.channel())
                        || UsageRow.CONFIRMED.equals(row.status())
                        || (row.endedAt() == null && row.startedAt().isAfter(now.minus(IntegrationsTelephony.HOLD)))) continue;
                if (recoverRow(row, apiKey, now)) recovered++;
            }
        }
        return recovered;
    }

    private boolean recoverRow(UsageRow row, String apiKey, Instant now) {
        String leg = calls.leg(row.id()).orElse(row.externalId());
        if (leg == null) return false;
        try {
            var response = client.whatsAppDetailRecord(apiKey, leg);
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOG.warnf("WhatsApp detail-record recovery returned HTTP %d", response.statusCode());
                return false;
            }
            JsonNode body = json.readTree(response.body());
            if (body == null || !body.path("data").isArray()) return false;
            for (JsonNode cdr : body.path("data")) {
                if (leg.equals(cdr.path("call_control_id").asText())
                        && config.isApplication(cdr.path("connection_id").asText())) {
                    return Boolean.TRUE.equals(usage.locked(row.connectionId(), () -> confirm(row.id(), leg, cdr, now)));
                }
            }
        } catch (IOException e) {
            LOG.warn("Could not read WhatsApp detail records; the next reconcile will retry");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return false;
    }

    private boolean confirm(String ref, String leg, JsonNode cdr, Instant now) {
        UsageRow current = usage.find(ref).orElse(null);
        Instant ended = time(cdr.path("finished_at").asText(null));
        if (current == null || UsageRow.CONFIRMED.equals(current.status()) || ended == null) return false;
        Instant answered = time(cdr.path("answered_at").asText(null));
        int seconds = answered == null ? 0 : Math.max(0, cdr.path("call_sec").asInt(0));
        UsageRow confirmed = current.providerData(leg, current.calleeNumber(),
                time(cdr.path("started_at").asText(null)), answered, current.caseRef());
        usage.update(confirmed.confirmed(seconds, decimal(cdr.path("cost").asText(null)),
                cdr.path("currency").asText(null), UsageRow.SOURCE_DETAIL_RECORD, ended, now));
        return true;
    }

    private static Instant time(String value) {
        try {
            return value == null ? null : Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static BigDecimal decimal(String value) {
        try {
            return value == null ? null : new BigDecimal(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
