package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.core.iam.NotificationRecipients;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaNotifications;
import com.fasterxml.jackson.databind.ObjectMapper;
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
        Plan plan = new Plan(new BigDecimal("0.00"), 1000, new BigDecimal("0.005"), 80, false, null, null);
        final Map<String, Subscription> subscriptions = new HashMap<>();
        final List<Map<String, Object>> notifications = new ArrayList<>();
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
                            int alertPct, boolean enforced, String actor, List<String> recipients) {
            plan = new Plan(monthlyPriceUsd, resolutionsPerMonth, overagePriceUsd, alertPct, enforced, actor, null, recipients);
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
        public void saveSubscription(String organization, Integer monthlyQuota, String onExhausted, String actor, List<String> recipients) {
            subscriptions.put(organization, new Subscription(monthlyQuota, onExhausted, actor, null, recipients));
        }

        @Override
        public boolean notificationClaimed(String organization, LocalDate month, String level) {
            return alerted.contains(organization + "@" + month + ":" + level);
        }

        @Override
        public synchronized boolean claimNotification(String organization, LocalDate month, String level,
                String tenant, String key, Map<String, Object> payload) {
            if (!subscriptions.containsKey(organization) || !alerted.add(organization + "@" + month + ":" + level)) {
                return false;
            }
            notifications.add(payload);
            return true;
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

    /** The plan is enforced or not as given; its other values stay. */
    private GeocodingPlanService service(boolean enforced) {
        return service(enforced, CLOCK);
    }

    private GeocodingPlanService service(boolean enforced, Clock clock) {
        Plan p = plans.plan;
        plans.plan = new Plan(p.monthlyPriceUsd(), p.resolutionsPerMonth(), p.overagePriceUsd(), p.alertPct(), enforced,
                p.updatedBy(), p.updatedAt(), p.whatsAppRecipients());
        return new GeocodingPlanService(plans, new GeocodingEvents(e -> {
            events.add(e);
            return CompletableFuture.completedFuture(null);
        }), new GeocodingMetrics(meters), clock, new GeocodingQuotaNotifications(new NotificationRecipients(null, null) {
            @Override
            public OrganizationAudience organizationAdmins(String slug) {
                return new OrganizationAudience(1L, slug, "Example", TENANT, List.of("admin@example.com"));
            }

            @Override
            public List<String> platformOwners() {
                return List.of("owner@example.com");
            }
        }, plans, new ObjectMapper()));
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
        service.setPlan(new SetPlanRequest(new BigDecimal("99"), 20, new BigDecimal("2"), 80, null), "owner");
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
        assertTrue(plans.alerted.contains(ORG + "@2026-10-01:threshold"));
    }

    @Test
    void theAlertShareComesFromThePlan() {
        plans.plan = new Plan(BigDecimal.ZERO, 1000, BigDecimal.ZERO, 50, false, null, null);
        subscribe(10, "review");
        plans.used = 5;

        service(false).afterProviderCall(ORG, TENANT);

        assertEquals(1, events.size());
    }

    @Test
    void noAlertWithoutASubscriptionAndZeroQuotaOnlyAlertsExhaustion() {
        plans.used = 5000;
        service(false).afterProviderCall(ORG, TENANT);
        service(false).afterProviderCall(null, TENANT);
        subscribe(0, "review");
        service(false).afterProviderCall(ORG, TENANT);

        assertEquals(1, events.size());
        assertEquals(GeocodingEventCatalog.QUOTA_EXHAUSTED, events.get(0).type());
    }

    @Test
    void bothLevelsAreIndependentAndOnlyClaimedOnceInAMonth() {
        subscribe(100, "overage");
        plans.used = 100;
        var service = service(true);
        service.afterProviderCall(ORG, TENANT);
        service.afterProviderCall(ORG, TENANT);
        service.checkProviderCall(ORG);
        assertEquals(2, plans.notifications.size());
        assertEquals(List.of("threshold", "exhausted"), plans.notifications.stream().map(p -> p.get("level")).toList());
        assertEquals(2, events.size());
    }

    @Test
    void eachLevelCanBeClaimedInTheNextMonth() {
        subscribe(100, "review");
        plans.used = 100;
        service(true).afterProviderCall(ORG, TENANT);
        service(true, Clock.fixed(Instant.parse("2026-11-01T00:00:00Z"), ZoneOffset.UTC)).afterProviderCall(ORG, TENANT);
        assertEquals(4, plans.notifications.size());
        assertEquals("2026-11", plans.notifications.get(3).get("month"));
    }

    @Test
    void alertAt100StillHasTwoDistinctLevels() {
        plans.plan = new Plan(BigDecimal.ZERO, 100, BigDecimal.ZERO, 100, true, null, null);
        subscribe(null, "review");
        plans.used = 99;
        var service = service(true);
        service.afterProviderCall(ORG, TENANT);
        assertTrue(plans.notifications.isEmpty());
        plans.used = 100;
        service.afterProviderCall(ORG, TENANT);
        assertEquals(2, plans.notifications.size());
    }

    @Test
    void refusalAlsoQueuesAnExistingExhaustedOrZeroQuota() {
        subscribe(0, "review");
        var service = service(true);
        assertEquals(GeocodingPlanService.QUOTA_EXHAUSTED, service.checkProviderCall(ORG).code());
        service.checkProviderCall(ORG);
        assertEquals(1, plans.notifications.size());
        assertEquals(100, plans.notifications.get(0).get("usedPct"));
    }

    @Test
    void validatesDeduplicatesAndPreservesOptionalRecipients() {
        var service = service(true);
        var phones = List.of("+15550000001", "+15550000001");
        var subscription = service.setSubscription(ORG, new SetSubscriptionRequest(10, "review", phones), "owner");
        assertEquals(List.of("+15550000001"), subscription.whatsAppRecipients());
        assertEquals(subscription.whatsAppRecipients(), service.setSubscription(ORG,
                new SetSubscriptionRequest(10, "review"), "owner").whatsAppRecipients());
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG,
                new SetSubscriptionRequest(10, "review", List.of("15550000001")), "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG,
                new SetSubscriptionRequest(10, "review", java.util.Collections.nCopies(21, "+15550000001")), "owner"));
        assertTrue(service.setSubscription(ORG, new SetSubscriptionRequest(10, "review", List.of()), "owner")
                .whatsAppRecipients().isEmpty());
    }

    @Test
    void platformRecipientsStayOutOfTheOrganizationPlanResponse() {
        plans.plan = new Plan(BigDecimal.ZERO, 100, BigDecimal.ZERO, 80, true, null, null, List.of("+15550000001"));
        assertEquals(List.of("+15550000001"), service(true).plan().whatsAppRecipients());
        assertTrue(service(true).orgPlan(ORG, null).plan().whatsAppRecipients().isEmpty());
    }

    @Test
    void notificationPayloadSnapshotsTermsAndRecipients() {
        subscribe(100, "overage");
        plans.subscriptions.put(ORG, new Subscription(100, "overage", null, null, List.of("+15550000002")));
        plans.plan = new Plan(BigDecimal.ZERO, 1000, new BigDecimal("0.005"), 80, true, null, null, List.of("+15550000001"));
        plans.used = 100;
        service(true).afterProviderCall(ORG, TENANT);
        var payload = plans.notifications.get(1);
        assertEquals(ORG, payload.get("organization"));
        assertEquals("Example", payload.get("organizationName"));
        assertEquals(TENANT, payload.get("tenantCode"));
        assertEquals("2026-10", payload.get("month"));
        assertEquals(100L, payload.get("used"));
        assertEquals(100, payload.get("quota"));
        assertEquals(List.of("owner@example.com"), payload.get("platformEmails"));
        assertEquals(List.of("admin@example.com"), payload.get("adminEmails"));
        assertEquals(List.of("+15550000002"), payload.get("orgWhatsAppRecipients"));
        assertEquals(List.of("+15550000001"), payload.get("platformWhatsAppRecipients"));
        assertEquals("/app/es/users/settings/geocoding", payload.get("usagePath"));
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
        plans.plan = new Plan(new BigDecimal("49.00"), 1000, new BigDecimal("0.004"), 80, false, null, null);
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
        SetPlanRequest negative = new SetPlanRequest(BigDecimal.ONE, -1, BigDecimal.ONE, null, null);
        SetPlanRequest invalidAlert = new SetPlanRequest(BigDecimal.ONE, 10, BigDecimal.ONE, 0, null);
        assertThrows(IllegalArgumentException.class, () -> service.setPlan(negative, "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.setPlan(invalidAlert, "owner"));

        Plan plan = service.setPlan(new SetPlanRequest(new BigDecimal("49.00"), 5000, new BigDecimal("0.004"), null,
                null), "owner");
        assertEquals(80, plan.alertPct());
        assertEquals(5000, plan.resolutionsPerMonth());
        assertFalse(plan.enforced());

        plan = service.setPlan(new SetPlanRequest(new BigDecimal("49.00"), 5000, new BigDecimal("0.004"), null, true),
                "owner");
        assertTrue(plan.enforced());
        assertTrue(service.orgPlan(ORG, null).enforced());
        plan = service.setPlan(new SetPlanRequest(new BigDecimal("49.00"), 5000, new BigDecimal("0.004"), null, null),
                "owner");
        assertTrue(plan.enforced());
    }

    @Test
    void theSubscriptionIsValidated() {
        GeocodingPlanService service = service(false);
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, null, "owner"));
        SetSubscriptionRequest negative = new SetSubscriptionRequest(-1, null);
        SetSubscriptionRequest invalidMode = new SetSubscriptionRequest(10, "block");
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, negative, "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, invalidMode, "owner"));

        Subscription s = service.setSubscription(ORG, new SetSubscriptionRequest(null, null), "owner");
        assertNull(s.monthlyQuota());
        assertEquals("review", s.onExhausted());
    }
}
