package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.harness.HarnessPlanGate.Refusal;
import com.microboxlabs.miot.integrations.domain.ModelProvider;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.OrgPlanResponse;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.PoolUse;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.SetPlanRequest;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.SetSubscriptionRequest;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Subscription;
import com.microboxlabs.miot.integrations.persistence.HarnessPlanRepository;
import com.microboxlabs.miot.integrations.persistence.ModelProviderRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class HarnessPlanServiceTest {

    private static final String ORG = "acme";
    private static final String MODEL = "openrouter:deepseek/deepseek-v4-flash";

    /** In-memory storage; pool usage is set per test. */
    static final class Plans extends HarnessPlanRepository {
        Plan plan = new Plan(new BigDecimal("25.00"), 10_000_000, new BigDecimal("20.00"), null, null);
        final Map<String, Subscription> subscriptions = new HashMap<>();
        long used;
        OffsetDateTime usedFrom;

        Plans() {
            super(null);
        }

        @Override
        public Plan plan() {
            return plan;
        }

        @Override
        public Plan setPlan(BigDecimal seatPriceUsd, long tokensPerSeat, BigDecimal yearlyDiscountPct, String actor) {
            plan = new Plan(seatPriceUsd, tokensPerSeat, yearlyDiscountPct, actor, null);
            return plan;
        }

        @Override
        public Subscription subscription(String organization) {
            return subscriptions.get(organization);
        }

        @Override
        public boolean isSeatMember(String organization, String email) {
            Subscription s = subscriptions.get(organization);
            return s != null && s.members().contains(email);
        }

        @Override
        public void saveSubscription(String organization, int seats, String billingCycle, String accessMode,
                                     List<String> members, String actor) {
            subscriptions.put(organization, new Subscription(seats, billingCycle, accessMode, members, actor, null));
        }

        @Override
        public long poolUsed(String organization, OffsetDateTime from, OffsetDateTime to) {
            usedFrom = from;
            return used;
        }

        @Override
        public List<PoolUse> useByMember(String organization, OffsetDateTime from, OffsetDateTime to) {
            return List.of(new PoolUse("alice@acme.test", 2, 100, 100));
        }

        @Override
        public List<PoolUse> useByModel(String organization, OffsetDateTime from, OffsetDateTime to) {
            return List.of(new PoolUse("anthropic:claude-opus-5-5", 1, 10, 30),
                    new PoolUse("openrouter:deepseek/deepseek-v4-flash", 1, 70, 70));
        }
    }

    static final class Providers extends ModelProviderRepository {
        final List<ModelProvider> rows = new ArrayList<>();

        Providers() {
            super(null);
        }

        @Override
        public List<ModelProvider> list() {
            return rows;
        }
    }

    private final Plans plans = new Plans();
    private final Providers providers = new Providers();
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-27T13:00:00Z"), ZoneOffset.UTC);

    private HarnessPlanService service(boolean enforced) {
        if (providers.rows.isEmpty()) {
            offer("openrouter", "deepseek/deepseek-v4-flash", null);
        }
        return new HarnessPlanService(plans, providers, enforced, clock);
    }

    private void offer(String provider, String model, String multiplier) {
        offer(provider, model, multiplier, false);
    }

    private void offer(String provider, String model, String multiplier, boolean isDefault) {
        providers.rows.add(new ModelProvider(provider, null, "enc", "…1234",
                List.of(new ModelProvider.Model(model, null, null, isDefault,
                        multiplier == null ? null : new BigDecimal(multiplier))),
                true, "owner", null));
    }

    private void subscribe(int seats, String mode, String... members) {
        plans.subscriptions.put(ORG, new Subscription(seats, "monthly", mode, List.of(members), "admin", null));
    }

    private static String code(Refusal refusal) {
        return refusal == null ? null : refusal.code();
    }

    @Test
    void notEnforcedNeverRefuses() {
        assertNull(service(false).checkRun(ORG, "alice@acme.test", "anything"));
    }

    @Test
    void anOrgWithoutSeatsIsRefused() {
        assertEquals(HarnessPlanService.NO_SUBSCRIPTION, code(service(true).checkRun(ORG, "alice@acme.test", MODEL)));
    }

    @Test
    void accessModeDecidesWhoHasASeat() {
        HarnessPlanService service = service(true);

        subscribe(2, "some", "alice@acme.test");
        assertNull(service.checkRun(ORG, "Alice@Acme.test", MODEL), "emails compare without case");
        assertEquals(HarnessPlanService.NO_SEAT, code(service.checkRun(ORG, "bob@acme.test", MODEL)));

        subscribe(2, "none");
        assertEquals(HarnessPlanService.NO_SEAT, code(service.checkRun(ORG, "alice@acme.test", MODEL)));

        subscribe(2, "all");
        assertNull(service.checkRun(ORG, "bob@acme.test", MODEL));
        assertNull(service.checkRun(ORG, null, MODEL), "a machine token needs no seat");
    }

    @Test
    void zeroSeatsIsNoSubscription() {
        subscribe(0, "all");
        assertEquals(HarnessPlanService.NO_SUBSCRIPTION, code(service(true).checkRun(ORG, "alice@acme.test", MODEL)));
    }

    @Test
    void aRunWithoutAModelGetsThePlatformDefaultElseTheFirstOffered() {
        offer("openrouter", "deepseek/deepseek-v4-flash", null);
        offer("anthropic", "claude-opus-5-5", "3");
        assertEquals(MODEL, service(true).defaultModel(), "no default set: the first offered");

        providers.rows.clear();
        offer("openrouter", "deepseek/deepseek-v4-flash", null);
        offer("anthropic", "claude-opus-5-5", "3", true);
        assertEquals("claude-opus-5-5", service(true).defaultModel());

        assertNull(service(false).defaultModel(), "not enforced: the harness picks");
    }

    @Test
    void aRunWithNoOfferedModelIsRefused() {
        subscribe(1, "all");
        assertEquals(HarnessPlanService.MODEL_NOT_OFFERED, code(service(true).checkRun(ORG, "alice@acme.test", null)));
    }

    @Test
    void theMonthlyPoolIsSeatsTimesTokensPerSeat() {
        HarnessPlanService service = service(true);
        subscribe(2, "all");

        plans.used = 19_999_999;
        assertNull(service.checkRun(ORG, "alice@acme.test", MODEL));
        assertEquals(OffsetDateTime.parse("2026-09-01T00:00:00Z"), plans.usedFrom, "counted from the 1st, UTC");

        plans.used = 20_000_000;
        assertEquals(HarnessPlanService.POOL_EXHAUSTED, code(service.checkRun(ORG, "alice@acme.test", MODEL)));
    }

    @Test
    void onlyModelsSetInTheProvidersMayBeNamed() {
        offer("openrouter", "deepseek/deepseek-v4-flash", null);
        subscribe(1, "all");
        HarnessPlanService service = service(true);

        assertNull(service.checkRun(ORG, "alice@acme.test", "openrouter:deepseek/deepseek-v4-flash"));
        assertEquals(HarnessPlanService.MODEL_NOT_OFFERED,
                code(service.checkRun(ORG, "alice@acme.test", "claude-sonnet-4-6")));
    }

    @Test
    void theModelListCarriesMultipliersAndDropsUnlistedModelsWhenEnforced() {
        offer("openrouter", "deepseek/deepseek-v4-flash", null);
        offer("anthropic", "claude-opus-5-5", "3");
        Map<String, Object> harness = new LinkedHashMap<>();
        harness.put("default", "openrouter:deepseek/deepseek-v4-flash");
        harness.put("models", List.of("openrouter:deepseek/deepseek-v4-flash", "claude-sonnet-4-6", "claude-opus-5-5"));

        Map<String, Object> enforced = service(true).models(harness);
        assertEquals(List.of("openrouter:deepseek/deepseek-v4-flash", "claude-opus-5-5"), enforced.get("models"));
        assertEquals(Map.of("openrouter:deepseek/deepseek-v4-flash", BigDecimal.ONE,
                "claude-opus-5-5", new BigDecimal("3")), enforced.get("multipliers"));
        assertEquals("openrouter:deepseek/deepseek-v4-flash", enforced.get("default"));

        harness.put("default", "claude-sonnet-4-6");
        assertEquals("openrouter:deepseek/deepseek-v4-flash", service(true).models(harness).get("default"),
                "an unoffered harness default is replaced");

        Map<String, Object> open = service(false).models(harness);
        assertEquals(3, ((List<?>) open.get("models")).size(), "not enforced keeps every model");
    }

    @Test
    void theOrgPageShowsThePoolAndUseByModelAsRunsNameThem() {
        subscribe(3, "all");
        plans.used = 100;

        OrgPlanResponse page = service(true).orgPlan(ORG);

        assertEquals(30_000_000, page.pool().included());
        assertEquals(100, page.pool().used());
        assertEquals(OffsetDateTime.parse("2026-10-01T00:00:00Z"), page.pool().periodEnd());
        assertEquals("claude-opus-5-5", page.pool().byModel().get(0).key());
        assertEquals("openrouter:deepseek/deepseek-v4-flash", page.pool().byModel().get(1).key());
    }

    @Test
    void anOrgWithoutASubscriptionHasAnEmptyPool() {
        assertEquals(0, service(true).orgPlan(ORG).pool().included());
    }

    @Test
    void subscriptionsAreValidated() {
        HarnessPlanService service = service(true);
        SetSubscriptionRequest tooMany = new SetSubscriptionRequest(1, "monthly", "some",
                List.of("a@acme.test", "b@acme.test"));
        SetSubscriptionRequest badCycle = new SetSubscriptionRequest(1, "weekly", "all", null);
        SetSubscriptionRequest badMode = new SetSubscriptionRequest(1, "monthly", "most", null);
        SetSubscriptionRequest badEmail = new SetSubscriptionRequest(1, "monthly", "some", List.of("alice"));
        SetSubscriptionRequest negative = new SetSubscriptionRequest(-1, "monthly", "all", null);
        SetSubscriptionRequest tooManySeats = new SetSubscriptionRequest(
                HarnessPlanService.MAX_SEATS + 1, "monthly", "all", null);

        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, tooMany, "admin"));
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, badCycle, "admin"));
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, badMode, "admin"));
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, badEmail, "admin"));
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, negative, "admin"));
        assertThrows(IllegalArgumentException.class, () -> service.setSubscription(ORG, tooManySeats, "admin"));
        assertEquals(0, plans.subscriptions.size());
    }

    @Test
    void membersAreStoredLowercaseAndOnlyForSome() {
        HarnessPlanService service = service(true);

        Subscription some = service.setSubscription(ORG, new SetSubscriptionRequest(2, "yearly", "some",
                List.of(" Alice@Acme.test ", "alice@acme.test")), "admin");
        assertEquals(List.of("alice@acme.test"), some.members());

        Subscription all = service.setSubscription(ORG, new SetSubscriptionRequest(2, "monthly", "all",
                List.of("alice@acme.test")), "admin");
        assertEquals(List.of(), all.members());
    }

    @Test
    void thePlanIsValidated() {
        HarnessPlanService service = service(true);
        SetPlanRequest negative = new SetPlanRequest(new BigDecimal("-1"), 1L, null);
        SetPlanRequest fullDiscount = new SetPlanRequest(BigDecimal.ONE, 1L, new BigDecimal("100"));
        SetPlanRequest tooManyTokens = new SetPlanRequest(BigDecimal.ONE,
                HarnessPlanService.MAX_TOKENS_PER_SEAT + 1, null);

        assertThrows(IllegalArgumentException.class, () -> service.setPlan(negative, "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.setPlan(fullDiscount, "owner"));
        assertThrows(IllegalArgumentException.class, () -> service.setPlan(tooManyTokens, "owner"));

        Plan saved = service.setPlan(new SetPlanRequest(new BigDecimal("30"), 12_000_000L, null), "owner");
        assertEquals(BigDecimal.ZERO, saved.yearlyDiscountPct());
    }
}
