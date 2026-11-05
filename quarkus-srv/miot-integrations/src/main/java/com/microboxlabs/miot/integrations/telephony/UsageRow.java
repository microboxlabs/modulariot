package com.microboxlabs.miot.integrations.telephony;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One call or WhatsApp template in the telephony ledger ({@code miot_integrations.telephony_usage}).
 * Only {@link #CONFIRMED} rows are charged.
 */
public record UsageRow(String id, String tenantCode, String channel, boolean managed, String connectionId,
        String externalId, String caseRef, String calleeNumber, String destinationType, String status,
        Instant answeredAt, Integer seconds, Integer billedMinutes, BigDecimal providerCost, String providerCurrency,
        String source, Instant startedAt, Instant endedAt, Instant confirmedAt) {

    public static final String VOICE = "VOICE";
    public static final String WHATSAPP_CALL = "WHATSAPP_CALL";
    public static final String WHATSAPP_TEMPLATE = "WHATSAPP_TEMPLATE";

    public static final String STARTED = "STARTED";
    public static final String ENDED = "ENDED";
    public static final String CONFIRMED = "CONFIRMED";
    public static final String EXPIRED = "EXPIRED";

    public static final String SOURCE_WEBHOOK = "WEBHOOK";
    public static final String SOURCE_DETAIL_RECORD = "DETAIL_RECORD";
    public static final String SOURCE_MESSAGE_POOL = "MESSAGE_POOL";

    /** Each call is rounded up to a whole minute; 0 seconds is 0 minutes. */
    public static int billedMinutes(int seconds) {
        return seconds <= 0 ? 0 : (int) ((seconds + 59L) / 60);
    }

    UsageRow retired() {
        return new UsageRow(id, tenantCode, channel, managed, connectionId, null, caseRef, calleeNumber,
                destinationType, EXPIRED, answeredAt, null, null, null, null, null, startedAt, endedAt, null);
    }

    UsageRow providerData(String externalId, String callee, Instant started, Instant answered, String caseRef) {
        return new UsageRow(id, tenantCode, channel, managed, connectionId, externalId, caseRef, callee,
                TelephonyPlanService.destinationType(callee), status, answered, seconds, billedMinutes,
                providerCost, providerCurrency, source, started == null ? startedAt : started, endedAt, confirmedAt);
    }

    UsageRow confirmed(int seconds, BigDecimal cost, String currency, String source, Instant endedAt, Instant now) {
        return new UsageRow(id, tenantCode, channel, managed, connectionId, externalId, caseRef, calleeNumber,
                destinationType, CONFIRMED, answeredAt, seconds, billedMinutes(seconds),
                cost != null ? cost : providerCost, cost != null ? currency : providerCurrency, source, startedAt,
                endedAt != null ? endedAt : this.endedAt, now);
    }
}
