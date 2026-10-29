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
     * site. {@code providerCostUsd} is what the provider charged the platform for the calls ({@code cost_usd} in
     * {@code geocode_usage}), null when none was priced or for an organization's own view.
     */
    public record SourceUse(
            String source,
            String result,
            long resolutions,
            long cacheHits,
            long providerCalls,
            BigDecimal providerCostUsd) {

        SourceUse withoutProviderCost() {
            return new SourceUse(source, result, resolutions, cacheHits, providerCalls, null);
        }
    }

    /**
     * One calendar month (UTC). {@code used} is the provider calls; {@code quota} is null without a subscription.
     * {@code providerCostUsd} is the platform's cost, shown only to the platform owner. {@code chargeUsd} is what
     * the organization is charged from the plan: the monthly price plus {@code overageUsd}, which is charged only
     * with {@code onExhausted = overage}. It is null without a subscription or when historical billing terms are unavailable.
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
            BigDecimal chargeUsd,
            List<SourceUse> bySource) {

        /** For the organization: the platform's provider cost is left out. */
        public Usage withoutProviderCost() {
            return new Usage(periodStart, periodEnd, quota, used, resolutions, cacheHits, null, overageCalls,
                    overageUsd, chargeUsd, bySource.stream().map(SourceUse::withoutProviderCost).toList());
        }
    }

    /** What the organization's Geocoding settings page shows. Its usage has no provider cost. */
    public record OrgPlanResponse(Plan plan, Subscription subscription, Usage usage, boolean enforced) {
    }

    /** One organization's month, for the platform owner. */
    public record OrgUsage(String organization, Subscription subscription, Usage usage) {
    }
}
