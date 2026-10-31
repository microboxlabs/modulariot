package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.core.geocoding.GeocodingGate.Refusal;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.OrgPlanResponse;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.OrgUsage;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SetPlanRequest;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SetSubscriptionRequest;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SourceUse;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Subscription;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Usage;
import com.microboxlabs.miot.integrations.geocoding.GeocodingEvents;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaNotification;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaNotifications;
import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaData;
import com.microboxlabs.miot.integrations.persistence.GeocodingPlanRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

/**
 * The geocoding plan. An organization's subscription gives it a quota of provider calls for the calendar month
 * (UTC): its own, else the plan's. Only provider calls count. Once the quota is used, a subscription that stops on
 * exhaustion gets no more provider calls; one with overage goes on and is charged the overage price per call. When
 * the calls reach the plan's alert share of the quota, the organization is warned once that month.
 *
 * <p>While the plan is not enforced, provider calls are never refused; usage is still recorded, shown and alerted
 * on. The platform owner turns it on in Settings › Plataforma.
 *
 * <p>Validation throws {@link IllegalArgumentException}, which the resources map to 400.
 */
@ApplicationScoped
public class GeocodingPlanService {

    private static final Logger LOG = Logger.getLogger(GeocodingPlanService.class);

    public static final String NO_SUBSCRIPTION = "geocoding_no_subscription";
    public static final String QUOTA_EXHAUSTED = "geocoding_quota_exhausted";

    public static final String REVIEW = "review";
    public static final String OVERAGE = "overage";
    private static final Set<String> ON_EXHAUSTED = Set.of(REVIEW, OVERAGE);

    private final GeocodingPlanRepository repository;
    private final GeocodingEvents events;
    private final GeocodingMetrics metrics;
    private final Clock clock;
    private final GeocodingQuotaNotifications notifications;
    private static final Pattern E164 = Pattern.compile("\\+[1-9][0-9]{6,14}");

    public GeocodingPlanService(GeocodingPlanRepository repository, GeocodingEvents events, GeocodingMetrics metrics) {
        this(repository, events, metrics, Clock.systemUTC(), null);
    }

    GeocodingPlanService(GeocodingPlanRepository repository, GeocodingEvents events, GeocodingMetrics metrics,
            Clock clock) {
        this(repository, events, metrics, clock, null);
    }

    @Inject
    public GeocodingPlanService(GeocodingPlanRepository repository, GeocodingEvents events,
                                GeocodingMetrics metrics, GeocodingQuotaNotifications notifications) {
        this(repository, events, metrics, Clock.systemUTC(), notifications);
    }

    GeocodingPlanService(GeocodingPlanRepository repository, GeocodingEvents events, GeocodingMetrics metrics,
                         Clock clock, GeocodingQuotaNotifications notifications) {
        this.repository = repository;
        this.events = events;
        this.metrics = metrics;
        this.clock = clock;
        this.notifications = notifications;
    }

    public Plan plan() {
        return repository.plan();
    }

    public Plan setPlan(SetPlanRequest req, String actor) {
        if (req == null || req.monthlyPriceUsd() == null || req.resolutionsPerMonth() == null
                || req.overagePriceUsd() == null) {
            throw new IllegalArgumentException("monthlyPriceUsd, resolutionsPerMonth and overagePriceUsd are required");
        }
        if (req.monthlyPriceUsd().signum() < 0 || req.resolutionsPerMonth() < 0 || req.overagePriceUsd().signum() < 0) {
            throw new IllegalArgumentException("prices and resolutionsPerMonth cannot be negative");
        }
        int alertPct = req.alertPct() == null ? 80 : req.alertPct();
        if (alertPct < 1 || alertPct > 100) {
            throw new IllegalArgumentException("alertPct must be from 1 to 100");
        }
        boolean enforced = req.enforced() == null ? repository.plan().enforced() : req.enforced();
        return repository.setPlan(req.monthlyPriceUsd(), req.resolutionsPerMonth(), req.overagePriceUsd(), alertPct,
                enforced, actor, validateRecipients(req.whatsAppRecipients(), repository.plan().whatsAppRecipients()));
    }

    public Subscription setSubscription(String organization, SetSubscriptionRequest req, String actor) {
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        if (req.monthlyQuota() != null && req.monthlyQuota() < 0) {
            throw new IllegalArgumentException("monthlyQuota cannot be negative");
        }
        String onExhausted = req.onExhausted() == null ? REVIEW : req.onExhausted();
        if (!ON_EXHAUSTED.contains(onExhausted)) {
            throw new IllegalArgumentException("onExhausted must be review or overage");
        }
        Subscription current = repository.subscription(organization);
        repository.saveSubscription(organization, req.monthlyQuota(), onExhausted, actor,
                validateRecipients(req.whatsAppRecipients(), current == null ? List.of() : current.whatsAppRecipients()));
        return repository.subscription(organization);
    }

    /** {@code month} null is the current one. The platform's provider cost is left out. */
    public OrgPlanResponse orgPlan(String organization, YearMonth month) {
        YearMonth period = or(month);
        Plan terms = planFor(period);
        Subscription subscription = subscriptionFor(organization, period);
        return new OrgPlanResponse((terms == null ? repository.plan() : terms).withoutPlatformRecipients(), subscription,
                usage(organization, terms, subscription, period).withoutProviderCost(), repository.plan().enforced());
    }

    /** Every organization with a subscription or with usage in the month, with the platform's provider cost. */
    public List<OrgUsage> allUsage(YearMonth month) {
        YearMonth m = or(month);
        Plan plan = planFor(m);
        return repository.organizations(start(m), start(m.plusMonths(1))).stream().map(org -> {
            Subscription subscription = subscriptionFor(org, m);
            return new OrgUsage(org, subscription, usage(org, plan, subscription, m));
        }).toList();
    }

    /**
     * Null when the provider may be called. Without an organization nothing can be counted, so only an enforced plan
     * refuses it.
     */
    public Refusal checkProviderCall(String organization) {
        return checkProviderCall(organization, null);
    }

    public Refusal checkProviderCall(String organization, String tenantCode) {
        Plan plan = repository.plan();
        if (!plan.enforced()) {
            return null;
        }
        Subscription subscription = organization == null ? null : repository.subscription(organization);
        if (subscription == null) {
            return refuse(NO_SUBSCRIPTION, "the organization has no geocoding plan");
        }
        int quota = quota(plan, subscription);
        YearMonth month = YearMonth.now(clock);
        long used = repository.providerCalls(organization, start(month), start(month.plusMonths(1)));
        metrics.quota(organization, used, quota);
        if (used >= quota) {
            notifyLevels(organization, tenantCode, subscription, plan, quota, month, used);
        }
        if (used >= quota && REVIEW.equals(subscription.onExhausted())) {
            return refuse(QUOTA_EXHAUSTED, "the organization used its " + quota
                    + " geocoding resolutions for this month");
        }
        return null;
    }

    /** After a recorded provider call: updates the quota gauge and notifies each monthly quota level. */
    public void afterProviderCall(String organization, String tenantCode) {
        if (organization == null) {
            return;
        }
        Subscription subscription = repository.subscription(organization);
        if (subscription == null) {
            return;
        }
        Plan plan = repository.plan();
        int quota = quota(plan, subscription);
        YearMonth month = YearMonth.now(clock);
        long used = repository.providerCalls(organization, start(month), start(month.plusMonths(1)));
        metrics.quota(organization, used, quota);
        notifyLevels(organization, tenantCode, subscription, plan, quota, month, used);
    }

    private void notifyLevels(String organization, String tenantCode, Subscription subscription, Plan plan,
            int quota, YearMonth month, long used) {
        int pct = quota == 0 ? 100 : (int) Math.min(Integer.MAX_VALUE, used * 100 / quota);
        if (quota > 0 && used * 100 >= (long) plan.alertPct() * quota) {
            notifyLevel(organization, tenantCode, subscription, plan, quota, month, used, pct,
                    GeocodingQuotaNotification.THRESHOLD);
        }
        if (used >= quota) {
            notifyLevel(organization, tenantCode, subscription, plan, quota, month, used, pct,
                    GeocodingQuotaNotification.EXHAUSTED);
        }
    }

    private void notifyLevel(String organization, String tenantCode, Subscription subscription, Plan plan,
            int quota, YearMonth month, long used, int pct, String level) {
        try {
            if (!notifications.enqueue(organization, month, level, used, quota, pct, plan, subscription)) {
                return;
            }
            LOG.warnf("Geocoding quota %s: %s used %d of %d provider calls in %s (%d%%)", level,
                    organization, used, quota, month, pct);
            var data = new GeocodingQuotaData(organization, month.toString(), used, quota, pct, subscription.onExhausted());
            if (tenantCode != null) {
                events.quotaLevel(tenantCode, data, level);
            }
        } catch (RuntimeException e) {
            LOG.warnf("Geocoding quota %s notification could not be enqueued for %s (%s)", level,
                    organization, e.getClass().getSimpleName());
        }
    }

    static List<String> validateRecipients(List<String> recipients, List<String> current) {
        if (recipients == null) {
            return current;
        }
        if (recipients.size() > 20 || recipients.stream().anyMatch(p -> p == null || !E164.matcher(p).matches())) {
            throw new IllegalArgumentException("whatsAppRecipients must contain at most 20 E.164 numbers");
        }
        return recipients.stream().distinct().toList();
    }

    private Usage usage(String organization, Plan plan, Subscription subscription, YearMonth month) {
        OffsetDateTime from = start(month);
        OffsetDateTime to = start(month.plusMonths(1));
        List<SourceUse> bySource = repository.bySource(organization, from, to);
        long used = bySource.stream().mapToLong(SourceUse::providerCalls).sum();
        long resolutions = bySource.stream().mapToLong(SourceUse::resolutions).sum();
        long cacheHits = bySource.stream().mapToLong(SourceUse::cacheHits).sum();
        BigDecimal cost = bySource.stream().map(SourceUse::providerCostUsd).filter(c -> c != null)
                .reduce(BigDecimal::add).orElse(null);
        Integer quota = subscription == null || plan == null ? null : quota(plan, subscription);
        long overage = quota == null ? 0 : Math.max(0, used - quota);
        BigDecimal overageUsd = subscription != null && plan != null && OVERAGE.equals(subscription.onExhausted())
                ? plan.overagePriceUsd().multiply(BigDecimal.valueOf(overage))
                : BigDecimal.ZERO;
        BigDecimal charge = subscription == null || plan == null ? null : plan.monthlyPriceUsd().add(overageUsd);
        return new Usage(from, to, quota, used, resolutions, cacheHits, cost, overage, overageUsd, charge, bySource);
    }

    private Plan planFor(YearMonth period) {
        return period.isBefore(YearMonth.now(clock)) ? repository.planAt(start(period.plusMonths(1))) : repository.plan();
    }

    private Subscription subscriptionFor(String organization, YearMonth period) {
        return period.isBefore(YearMonth.now(clock))
                ? repository.subscriptionAt(organization, start(period.plusMonths(1))) : repository.subscription(organization);
    }

    private Refusal refuse(String code, String message) {
        metrics.quotaRefusal(code);
        return new Refusal(code, message);
    }

    private static int quota(Plan plan, Subscription subscription) {
        return subscription.monthlyQuota() != null ? subscription.monthlyQuota() : plan.resolutionsPerMonth();
    }

    private YearMonth or(YearMonth month) {
        return month != null ? month : YearMonth.now(clock);
    }

    private static OffsetDateTime start(YearMonth month) {
        return month.atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);
    }
}
