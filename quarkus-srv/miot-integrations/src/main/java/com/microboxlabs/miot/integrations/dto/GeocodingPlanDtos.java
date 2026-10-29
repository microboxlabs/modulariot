package com.microboxlabs.miot.integrations.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/** Request and response shapes for the geocoding plan. Prices are USD. */
public final class GeocodingPlanDtos {

    private GeocodingPlanDtos() {
    }

    /**
     * The plan every organization subscribes to. {@code resolutionsPerMonth} is the quota of provider calls of a
     * subscription without its own; {@code alertPct} is the share of the quota at which the organization is warned.
     */
    public record Plan(
            BigDecimal monthlyPriceUsd,
            int resolutionsPerMonth,
            BigDecimal overagePriceUsd,
            int alertPct,
            String updatedBy,
            OffsetDateTime updatedAt) {
    }

    public record SetPlanRequest(
            BigDecimal monthlyPriceUsd,
            Integer resolutionsPerMonth,
            BigDecimal overagePriceUsd,
            Integer alertPct) {
    }

    /**
     * An organization's subscription. {@code monthlyQuota} null uses the plan's. {@code onExhausted} is
     * {@code review} (sites go to review once the quota is used) or {@code overage} (calls go on and are charged).
     */
    public record Subscription(
            Integer monthlyQuota,
            String onExhausted,
            String updatedBy,
            OffsetDateTime updatedAt) {
    }

    public record SetSubscriptionRequest(Integer monthlyQuota, String onExhausted) {
    }

    /**
     * Resolutions of one source and result in the period. {@code source} is {@code none} when no source placed the
     * site. {@code providerCostUsd} is what the provider charged for the calls, null when none was priced.
     */
    public record SourceUse(
            String source,
            String result,
            long resolutions,
            long cacheHits,
            long providerCalls,
            BigDecimal providerCostUsd) {
    }

    /**
     * One calendar month (UTC). {@code used} is the provider calls; {@code quota} is null without a subscription.
     * {@code overageUsd} is charged only with {@code onExhausted = overage}.
     */
    public record Usage(
            OffsetDateTime periodStart,
            OffsetDateTime periodEnd,
            Integer quota,
            long used,
            long resolutions,
            long cacheHits,
            BigDecimal providerCostUsd,
            long overageCalls,
            BigDecimal overageUsd,
            List<SourceUse> bySource) {
    }

    /** What the organization's Geocoding settings page shows. */
    public record OrgPlanResponse(Plan plan, Subscription subscription, Usage usage, boolean enforced) {
    }

    /** One organization's month, for the platform owner. */
    public record OrgUsage(String organization, Subscription subscription, Usage usage) {
    }
}
