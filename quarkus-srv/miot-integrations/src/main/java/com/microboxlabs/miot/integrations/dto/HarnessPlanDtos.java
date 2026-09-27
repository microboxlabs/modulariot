package com.microboxlabs.miot.integrations.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/** Request and response shapes for the harness seat plan. */
public final class HarnessPlanDtos {

    private HarnessPlanDtos() {
    }

    /** The plan every organization buys seats on. Prices are USD per seat per month. */
    public record Plan(
            BigDecimal seatPriceUsd,
            long tokensPerSeat,
            BigDecimal yearlyDiscountPct,
            String updatedBy,
            OffsetDateTime updatedAt) {
    }

    public record SetPlanRequest(BigDecimal seatPriceUsd, Long tokensPerSeat, BigDecimal yearlyDiscountPct) {
    }

    /**
     * An organization's seats and who may use the harness. {@code members} are
     * the emails allowed when {@code accessMode} is {@code some}.
     */
    public record Subscription(
            int seats,
            String billingCycle,
            String accessMode,
            List<String> members,
            String updatedBy,
            OffsetDateTime updatedAt) {
    }

    public record SetSubscriptionRequest(
            Integer seats,
            String billingCycle,
            String accessMode,
            List<String> members) {
    }

    /** Pool tokens one member or one model used in the period. */
    public record PoolUse(String key, long runs, long tokens, long poolTokens) {
    }

    /** The pool for the current calendar month (UTC). */
    public record Pool(
            OffsetDateTime periodStart,
            OffsetDateTime periodEnd,
            long included,
            long used,
            List<PoolUse> byMember,
            List<PoolUse> byModel) {
    }

    /** What the organization's Harness settings page shows. */
    public record OrgPlanResponse(Plan plan, Subscription subscription, Pool pool, boolean enforced) {
    }
}
