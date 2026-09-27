package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.core.harness.HarnessPlanGate.Refusal;
import com.microboxlabs.miot.integrations.domain.ModelProvider;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.OrgPlanResponse;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Pool;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.PoolUse;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.SetPlanRequest;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.SetSubscriptionRequest;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Subscription;
import com.microboxlabs.miot.integrations.persistence.HarnessPlanRepository;
import com.microboxlabs.miot.integrations.persistence.ModelProviderRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * The harness seat plan. An organization buys seats; each seat adds the plan's
 * tokens to the organization's pool for the calendar month (UTC). A model's
 * tokens count against the pool times its multiplier.
 *
 * <p>With {@code miot.harness.plan.enforce} off, runs are never refused and the
 * model list is not filtered; usage is still recorded and shown.
 *
 * <p>Validation throws {@link IllegalArgumentException}, which the resources map to 400.
 */
@ApplicationScoped
public class HarnessPlanService {

    public static final String NO_SUBSCRIPTION = "plan_no_subscription";
    public static final String NO_SEAT = "plan_no_seat";
    public static final String POOL_EXHAUSTED = "plan_pool_exhausted";
    public static final String MODEL_NOT_OFFERED = "plan_model_not_offered";

    private static final Set<String> CYCLES = Set.of("monthly", "yearly");
    private static final Set<String> MODES = Set.of("all", "some", "none");

    private final HarnessPlanRepository repository;
    private final ModelProviderRepository providers;
    private final boolean enforced;
    private final Clock clock;

    @Inject
    public HarnessPlanService(HarnessPlanRepository repository,
                              ModelProviderRepository providers,
                              @ConfigProperty(name = "miot.harness.plan.enforce", defaultValue = "false")
                              boolean enforced) {
        this(repository, providers, enforced, Clock.systemUTC());
    }

    HarnessPlanService(HarnessPlanRepository repository, ModelProviderRepository providers,
                       boolean enforced, Clock clock) {
        this.repository = repository;
        this.providers = providers;
        this.enforced = enforced;
        this.clock = clock;
    }

    public boolean enforced() {
        return enforced;
    }

    public Plan plan() {
        return repository.plan();
    }

    public Plan setPlan(SetPlanRequest req, String actor) {
        if (req == null || req.seatPriceUsd() == null || req.tokensPerSeat() == null) {
            throw new IllegalArgumentException("seatPriceUsd and tokensPerSeat are required");
        }
        if (req.seatPriceUsd().signum() < 0 || req.tokensPerSeat() < 0) {
            throw new IllegalArgumentException("seatPriceUsd and tokensPerSeat cannot be negative");
        }
        BigDecimal discount = req.yearlyDiscountPct() == null ? BigDecimal.ZERO : req.yearlyDiscountPct();
        if (discount.signum() < 0 || discount.compareTo(BigDecimal.valueOf(100)) >= 0) {
            throw new IllegalArgumentException("yearlyDiscountPct must be from 0 up to, not including, 100");
        }
        return repository.setPlan(req.seatPriceUsd(), req.tokensPerSeat(), discount, actor);
    }

    public OrgPlanResponse orgPlan(String organization) {
        Plan plan = repository.plan();
        Subscription subscription = repository.subscription(organization);
        OffsetDateTime start = periodStart();
        OffsetDateTime end = start.plusMonths(1);
        long included = subscription == null ? 0 : subscription.seats() * plan.tokensPerSeat();
        Pool pool = new Pool(start, end, included,
                repository.poolUsed(organization, start, end),
                repository.useByMember(organization, start, end),
                qualifiedKeys(repository.useByModel(organization, start, end)));
        return new OrgPlanResponse(plan, subscription, pool, enforced);
    }

    public Subscription setSubscription(String organization, SetSubscriptionRequest req, String actor) {
        if (req == null || req.seats() == null || req.billingCycle() == null || req.accessMode() == null) {
            throw new IllegalArgumentException("seats, billingCycle and accessMode are required");
        }
        if (req.seats() < 0) {
            throw new IllegalArgumentException("seats cannot be negative");
        }
        if (!CYCLES.contains(req.billingCycle())) {
            throw new IllegalArgumentException("billingCycle must be monthly or yearly");
        }
        if (!MODES.contains(req.accessMode())) {
            throw new IllegalArgumentException("accessMode must be all, some or none");
        }
        List<String> members = "some".equals(req.accessMode()) ? emails(req.members()) : List.of();
        if (members.size() > req.seats()) {
            throw new IllegalArgumentException(
                    members.size() + " members have access but there are only " + req.seats() + " seats");
        }
        repository.saveSubscription(organization, req.seats(), req.billingCycle(), req.accessMode(), members, actor);
        return repository.subscription(organization);
    }

    /**
     * Null when the run may start. A machine token (no email) skips the seat
     * check but not the pool.
     */
    public Refusal checkRun(String organization, String userEmail, String model) {
        if (!enforced) {
            return null;
        }
        if (model != null && !offeredModels().containsKey(model)) {
            return new Refusal(400, MODEL_NOT_OFFERED, "model " + model + " is not offered");
        }
        Subscription subscription = repository.subscription(organization);
        if (subscription == null) {
            return new Refusal(402, NO_SUBSCRIPTION, "the organization has no harness seats");
        }
        if (userEmail != null && !hasSeat(organization, subscription, userEmail)) {
            return new Refusal(403, NO_SEAT, userEmail + " has no harness seat");
        }
        OffsetDateTime start = periodStart();
        long included = subscription.seats() * repository.plan().tokensPerSeat();
        if (repository.poolUsed(organization, start, start.plusMonths(1)) >= included) {
            return new Refusal(402, POOL_EXHAUSTED, "the organization used its tokens for this month");
        }
        return null;
    }

    /**
     * The harness model list with each model's multiplier. When enforced, only
     * the models set in the platform's providers remain.
     */
    public Map<String, Object> models(Map<String, Object> harnessModels) {
        Map<String, BigDecimal> offered = offeredModels();
        List<String> names = new ArrayList<>();
        Object listed = harnessModels.get("models");
        if (listed instanceof List<?> list) {
            for (Object name : list) {
                if (name instanceof String s && (!enforced || offered.containsKey(s))) {
                    names.add(s);
                }
            }
        }
        Map<String, BigDecimal> multipliers = new LinkedHashMap<>();
        for (String name : names) {
            multipliers.put(name, offered.getOrDefault(name, BigDecimal.ONE));
        }
        Map<String, Object> out = new LinkedHashMap<>(harnessModels);
        out.put("models", names);
        out.put("multipliers", multipliers);
        return out;
    }

    private boolean hasSeat(String organization, Subscription subscription, String email) {
        return switch (subscription.accessMode()) {
            case "all" -> true;
            case "some" -> repository.isSeatMember(organization, email.toLowerCase(Locale.ROOT));
            default -> false;
        };
    }

    /** Every model the platform's enabled providers list, named as runs name them. */
    private Map<String, BigDecimal> offeredModels() {
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        for (ModelProvider p : providers.list()) {
            if (!p.enabled()) {
                continue;
            }
            for (ModelProvider.Model m : p.models()) {
                out.put(ModelProviderService.qualified(p.provider(), m.id()), m.poolMultiplier());
            }
        }
        return out;
    }

    private OffsetDateTime periodStart() {
        OffsetDateTime now = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        return now.withDayOfMonth(1).toLocalDate().atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    private static List<PoolUse> qualifiedKeys(List<PoolUse> uses) {
        return uses.stream().map(u -> {
            int colon = u.key().indexOf(':');
            String name = colon < 0 ? u.key()
                    : ModelProviderService.qualified(u.key().substring(0, colon), u.key().substring(colon + 1));
            return new PoolUse(name, u.runs(), u.tokens(), u.poolTokens());
        }).toList();
    }

    private static List<String> emails(List<String> raw) {
        Set<String> out = new LinkedHashSet<>();
        for (String email : raw == null ? List.<String>of() : raw) {
            String value = email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
            if (!value.contains("@")) {
                throw new IllegalArgumentException("not an email: " + email);
            }
            out.add(value);
        }
        return List.copyOf(out);
    }
}
