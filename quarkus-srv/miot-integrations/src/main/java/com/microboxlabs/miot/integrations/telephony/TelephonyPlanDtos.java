package com.microboxlabs.miot.integrations.telephony;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Request and response shapes of the telephony plan. Prices are USD. */
public final class TelephonyPlanDtos {

    public static final String CL_MOBILE = "CL_MOBILE";
    public static final String CL_LANDLINE = "CL_LANDLINE";
    public static final String OTHER = "OTHER";

    private TelephonyPlanDtos() {
    }

    /**
     * {@code minutesPerMonth} is the quota of an organization without its own. Voice prices are per billed minute,
     * by destination; {@code whatsappTemplateUsd} is per template. {@code enforced} refuses managed calls past
     * the quota; off, nothing is refused.
     */
    public record Plan(int minutesPerMonth, BigDecimal clMobileUsd, BigDecimal clLandlineUsd, BigDecimal otherUsd,
            BigDecimal whatsappCallUsd, BigDecimal whatsappTemplateUsd, boolean enforced, String updatedBy,
            Instant updatedAt) {

        public BigDecimal price(String destinationType) {
            BigDecimal p = switch (destinationType == null ? OTHER : destinationType) {
                case CL_MOBILE -> clMobileUsd;
                case CL_LANDLINE -> clLandlineUsd;
                case UsageRow.WHATSAPP_CALL -> whatsappCallUsd;
                case UsageRow.WHATSAPP_TEMPLATE -> whatsappTemplateUsd;
                default -> otherUsd;
            };
            return p == null ? BigDecimal.ZERO : p;
        }
    }

    /** {@code monthlyMinutes} null uses the plan's. */
    public record Subscription(Integer monthlyMinutes, String updatedBy, Instant updatedAt) {
    }

    public record SetSubscriptionRequest(Integer monthlyMinutes) {
    }

    /** Billed use of one channel and destination in the month. */
    public record Line(String channel, String destinationType, long calls, long seconds, long billedMinutes,
            BigDecimal chargeUsd, BigDecimal providerCost) {

        Line withoutProviderCost() {
            return new Line(channel, destinationType, calls, seconds, billedMinutes, chargeUsd, null);
        }
    }

    /**
     * One calendar month (UTC) of an organization's managed telephony. {@code quotaMinutes} and
     * {@code usedMinutes} are voice minutes. {@code pending} counts calls Telnyx has not confirmed yet.
     * {@code providerCost} is the platform's cost, shown only to the platform owner.
     */
    public record Usage(Instant periodStart, Instant periodEnd, int quotaMinutes, long usedMinutes, long pending,
            BigDecimal chargeUsd, BigDecimal providerCost, List<Line> lines) {

        public Usage withoutProviderCost() {
            return new Usage(periodStart, periodEnd, quotaMinutes, usedMinutes, pending, chargeUsd, null,
                    lines.stream().map(Line::withoutProviderCost).toList());
        }
    }

    public record OrgUsage(String tenantCode, Subscription subscription, Usage usage) {
    }

    public record OrgPlanResponse(Plan plan, Subscription subscription, Usage usage) {
    }
}
