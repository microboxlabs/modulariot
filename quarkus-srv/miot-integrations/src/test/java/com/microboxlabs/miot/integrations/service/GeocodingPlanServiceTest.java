package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.core.geocoding.GeocodingGate.Refusal;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.OrgPlanResponse;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.OrgUsage;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SetPlanRequest;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SetSubscriptionRequest;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SourceUse;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Subscription;
import com.microboxlabs.miot.integrations.geocoding.GeocodingEventCatalog;
import com.microboxlabs.miot.integrations.geocoding.GeocodingEvents;
import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaData;
import com.microboxlabs.miot.integrations.persistence.GeocodingPlanRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class GeocodingPlanServiceTest {

    private static final String ORG = "acme";
    private static final String TENANT = "client-a";
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-29T12:00:00Z"), ZoneOffset.UTC);

    /** In-memory storage; provider calls and usage by source are set per test. */
    static final class Plans extends GeocodingPlanRepository {
        Plan plan = new Plan(new BigDecimal("0.00"), 1000, new BigDecimal("0.005"), 80, null, null);
        final Map<String, Subscription> subscriptions = new HashMap<>();
        final Set<String> alerted = new HashSet<>();
        long used;
        OffsetDateTime usedFrom;
        OffsetDateTime usedTo;
        List<SourceUse> bySource = List.of();
        int subscriptionReads;
        boolean failing;
        boolean historicalOverride;
        Plan historicalPlan;
        final Map<String, Subscription> historicalSubscriptions = new HashMap<>();

        @Override
        public Plan planAt(OffsetDateTime end) {
            return historicalOverride ? historicalPlan : plan;
        }

        @Override
        public Subscription subscriptionAt(String organization, OffsetDateTime end) {
            return historicalOverride ? historicalSubscriptions.get(organization) : subscriptions.get(organization);
        }


        Plans() {
            super(null);
        }

        @Override
        public Plan plan() {
            return plan;
        }

        @Override
        public Plan setPlan(BigDecimal monthlyPriceUsd, int resolutionsPerMonth, BigDecimal overagePriceUsd,
                            int alertPct, String actor) {
            plan = new Plan(monthlyPriceUsd, resolutionsPerMonth, overagePriceUsd, alertPct, actor, null);
            return plan;
        }

        @Override
        public Subscription subscription(String organization) {
            subscriptionReads++;
            if (failing) {
                throw new IllegalStateException("database down");
            }
            return subscriptions.get(organization);
        }

        @Override
        public void saveSubscription(String organization, Integer monthlyQuota, String onExhausted, String actor) {
            subscriptions.put(organization, new Subscription(monthlyQuota, onExhausted, actor, null));
        }

        @Override
        public boolean claimAlert(String organization, LocalDate month) {
            return subscriptions.containsKey(organization) && alerted.add(organization + "@" + month);
        }

        @Override
        public long providerCalls(String organization, OffsetDateTime from, OffsetDateTime to) {
            usedFrom = from;
            usedTo = to;
            return used;
        }

        @Override
        public List<SourceUse> bySource(String organization, OffsetDateTime from, OffsetDateTime to) {
            usedFrom = from;
            return bySource;
        }

        @Override
        public List<String> organizations(OffsetDateTime from, OffsetDateTime to) {
            return List.copyOf(subscriptions.keySet());
        }
    }

    private final Plans plans = new Plans();
    private final List<OperationalEvent> events = new ArrayList<>();
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();

    private GeocodingPlanService service(boolean enforced) {
        return new GeocodingPlanService(plans, new GeocodingEvents(e -> {
            events.add(e);
            return CompletableFuture.completedFuture(null);
        }), new GeocodingMetrics(meters), enforced, CLOCK);
    }

    private void subscribe(Integer quota, String onExhausted) {
        plans.subscriptions.put(ORG, new Subscription(quota, onExhausted, null, null));
    }

    @Test
    void completedMonthsKeepTheirPricesQuotaAndExhaustionPolicy() {
        subscribe(100, "overage");
        plans.bySource = List.of(new SourceUse("provider", "resolved", 112, 0, 112, null));
        plans.historicalOverride = true;
        plans.historicalPlan = plans.plan;
        plans.historicalSubscriptions.put(ORG, plans.subscriptions.get(ORG));
        GeocodingPlanService service = service(false);
        var before = service.orgPlan(ORG, YearMonth.of(2026, 9));
        service.setPlan(new SetPlanRequest(new BigDecimal("99"), 20, new BigDecimal("2"), 80), "owner");
        service.setSubscription(ORG, new SetSubscriptionRequest(1, "review"), "owner");
        var after = service.orgPlan(ORG, YearMonth.of(2026, 9));
        assertEquals(before.usage(), after.usage());
        assertEquals(before.subscription(), after.subscription());
        assertEquals(0, new BigDecimal("0.06").compareTo(after.usage().chargeUsd()));
        assertEquals(new BigDecimal("99"), service.orgPlan(ORG, null).usage().chargeUsd());
    }

    @Test
    void aNewSubscriptionCannotChargeAnEarlierMonth() {
        plans.historicalOverride = true;
        plans.historicalPlan = plans.plan;
        GeocodingPlanService service = service(false);
        service.setSubscription(ORG, new SetSubscriptionRequest(1, "overage"), "owner");
        var past = service.orgPlan(ORG, YearMonth.of(2026, 9));
        assertNull(past.subscription());
        assertNull(past.usage().chargeUsd());
        assertNull(past.usage().quota());
    }

    @Test
    void unknownHistoricalPricesAreNotReplacedWithCurrentPrices() {
        plans.historicalOverride = true;
        plans.historicalSubscriptions.put(ORG, new Subscription(10, "overage", "owner", null));
        var past = service(false).orgPlan(ORG, YearMonth.of(2026, 9));
        assertNull(past.usage().chargeUsd());
        assertNull(past.usage().quota());
    }

    @Test
    void notEnforcedNeverRefuses() {
        plans.used = 5000;

        assertNull(service(false).checkProviderCall(ORG));
        assertNull(service(false).checkProviderCall(null));
    }

    @Test
    void enforcedRefusesWithoutASubscription() {
        Refusal r = service(true).checkProviderCall(ORG);

        assertEquals(GeocodingPlanService.NO_SUBSCRIPTION, r.code());
        assertEquals(GeocodingPlanService.NO_SUBSCRIPTION, service(true).checkProviderCall(null).code());
    }

    @Test
    void enforcedAllowsCallsUnderThePlansQuotaForTheCalendarMonth() {
        subscribe(null, "review");
        plans.used = 999;

        assertNull(service(true).checkProviderCall(ORG));
        assertEquals(OffsetDateTime.parse("2026-10-01T00:00Z"), plans.usedFrom);
        assertEquals(OffsetDateTime.parse("2026-11-01T00:00Z"), plans.usedTo);
    }

    @Test
    void anExhaustedQuotaRefusesAndIsCounted() {
        subscribe(null, "review");
        plans.used = 1000;

        Refusal r = service(true).checkProviderCall(ORG);

        assertEquals(GeocodingPlanService.QUOTA_EXHAUSTED, r.code());
        assertTrue(r.message().contains("1000"), r.message());
        assertEquals(1.0, meters.get("geocoding.quota.refusals").tags("code", GeocodingPlanService.QUOTA_EXHAUSTED)
                .counter().count());
        assertEquals(1000.0, meters.get("geocoding.quota.used").tags("organization", ORG).gauge().value());
        assertEquals(1000.0, meters.get("geocoding.quota.limit").tags("organization", ORG).gauge().value());
    }

    @Test
    void theSubscriptionsOwnQuotaWinsOverThePlans() {
        subscribe(10, "review");
        plans.used = 10;

        assertEquals(GeocodingPlanService.QUOTA_EXHAUSTED, service(true).checkProviderCall(ORG).code());
    }

    @Test
    void overageKeepsCallingOnceTheQuotaIsUsed() {
        subscribe(10, "overage");
        plans.used = 50;

        assertNull(service(true).checkProviderCall(ORG));
    }

    @Test
    void crossingTheAlertShareWarnsOncePerMonth() {
        subscribe(100, "review");
        GeocodingPlanService service = service(false);
        plans.used = 79;
        service.afterProviderCall(ORG, TENANT);
        assertTrue(events.isEmpty(), "under 80% nothing is sent");

        plans.used = 80;
        service.afterProviderCall(ORG, TENANT);
        plans.used = 81;
        service.afterProviderCall(ORG, TENANT);

        assertEquals(1, events.size());
        OperationalEvent e = events.get(0);
        assertEquals(GeocodingEventCatalog.QUOTA_THRESHOLD, e.type());
        assertEquals(TENANT, e.tenantCode());
        assertEquals(ORG, e.context().key());
        assertEquals(new GeocodingQuotaData(ORG, "2026-10", 80, 100, 80, "review"), e.data());
        assertTrue(plans.alerted.contains(ORG + "@2026-10-01"));
    }

    @Test
    void theAlertShareComesFromThePlan() {
        plans.plan = new Plan(BigDecimal.ZERO, 1000, BigDecimal.ZERO, 50, null, null);
        subscribe(10, "review");
        plans.used = 5;

        service(false).afterProviderCall(ORG, TENANT);

        assertEquals(1, events.size());
    }

    @Test
    void noAlertWithoutASubscriptionOrAQuota() {
        plans.used = 5000;
        service(false).afterProviderCall(ORG, TENANT);
        service(false).afterProviderCall(null, TENANT);
        subscribe(0, "review");
        service(false).afterProviderCall(ORG, TENANT);

        assertTrue(events.isEmpty());
    }

    @Test
    void monthlyUsageAddsUpTheSourcesAndPricesTheOverage() {
        subscribe(100, "overage");
        plans.bySource = List.of(
                new SourceUse("plus_code", "resolved", 40, 0, 0, null),
                new SourceUse("provider", "resolved", 120, 10, 110, new BigDecimal("0.55")),
                new SourceUse("none", "needs_review", 5, 0, 2, new BigDecimal("0.01")));

        OrgPlanResponse r = service(true).orgPlan(ORG, YearMonth.of(2026, 9));

        assertEquals(OffsetDateTime.parse("2026-09-01T00:00Z"), r.usage().periodStart());
        assertEquals(OffsetDateTime.parse("2026-10-01T00:00Z"), r.usage().periodEnd());
        assertEquals(100, r.usage().quota());
        assertEquals(112, r.usage().used());
        assertEquals(165, r.usage().resolutions());
        assertEquals(10, r.usage().cacheHits());
        assertEquals(12, r.usage().overageCalls());
        assertEquals(0, new BigDecimal("0.06").compareTo(r.usage().overageUsd()));
        assertEquals(0, new BigDecimal("0.06").compareTo(r.usage().chargeUsd()));
        assertTrue(r.enforced());
    }

    @Test
    void theProviderCostIsShownOnlyToThePlatform() {
        subscribe(100, "overage");
        plans.plan = new Plan(new BigDecimal("49.00"), 1000, new BigDecimal("0.004"), 80, null, null);
        plans.bySource = List.of(new SourceUse("provider", "resolved", 120, 10, 110, new BigDecimal("0.55")));

        OrgPlanResponse org = service(false).orgPlan(ORG, YearMonth.of(2026, 9));
        assertNull(org.usage().providerCostUsd());
        assertNull(org.usage().bySource().get(0).providerCostUsd());
        assertEquals(0, new BigDecimal("49.04").compareTo(org.usage().chargeUsd()));

        OrgUsage platform = service(false).allUsage(YearMonth.of(2026, 9)).get(0);
        assertEquals(new BigDecimal("0.55"), platform.usage().providerCostUsd());
        assertEquals(new BigDecimal("0.55"), platform.usage().bySource().get(0).providerCostUsd());
        assertEquals(0, new BigDecimal("49.04").compareTo(platform.usage().chargeUsd()));
    }

    @Test
    void reviewModeChargesNoOverageAndNoSubscriptionHasNoQuota() {
        plans.bySource = List.of(new SourceUse("provider", "resolved", 20, 0, 20, null));

        OrgPlanResponse none = service(false).orgPlan(ORG, null);
        assertNull(none.usage().quota());
        assertEquals(0, none.usage().overageCalls());
        assertNull(none.usage().providerCostUsd());
        assertNull(none.usage().chargeUsd());
        assertEquals(OffsetDateTime.parse("2026-10-01T00:00Z"), none.usage().periodStart());

        subscribe(10, "review");
        OrgPlanResponse review = service(false).orgPlan(ORG, null);
        assertEquals(10, review.usage().overageCalls());
        assertEquals(BigDecimal.ZERO, review.usage().overageUsd());
    }

    @Test
    void allUsageListsEachOrganization() {
        subscribe(null, "review");

        List<OrgUsage> all = service(false).allUsage(null);

        assertEquals(1, all.size());
        assertEquals(ORG, all.get(0).organization());
        assertEquals(1000, all.get(0).usage().quota());
    }

    @Test
    void thePlanIsValidated() {
        GeocodingPlanService service = service(false);
        assertThrows(IllegalArgumentException.class, () -> service.setPlan(null, "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.setPlan(
                new SetPlanRequest(BigDecimal.ONE, -1, BigDecimal.ONE, null), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.setPlan(
                new SetPlanRequest(BigDecimal.ONE, 10, BigDecimal.ONE, 0), "owner"));

        Plan plan = service.setPlan(new SetPlanRequest(new BigDecimal("49.00"), 5000, new BigDecimal("0.004"), null),
                "owner");
        assertEquals(80, plan.alertPct());
        assertEquals(5000, plan.resolutionsPerMonth());
    }

    @Test
    void theSubscriptionIsValidated() {
        GeocodingPlanService service = service(false);
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, null, "owner"));
        assertThrows(IllegalArgumentException.class,
                () -> service.setSubscription(ORG, new SetSubscriptionRequest(-1, null), "owner"));
        assertThrows(IllegalArgumentException.class,
                () -> service.setSubscription(ORG, new SetSubscriptionRequest(10, "block"), "owner"));

        Subscription s = service.setSubscription(ORG, new SetSubscriptionRequest(null, null), "owner");
        assertNull(s.monthlyQuota());
        assertEquals("review", s.onExhausted());
    }
}
