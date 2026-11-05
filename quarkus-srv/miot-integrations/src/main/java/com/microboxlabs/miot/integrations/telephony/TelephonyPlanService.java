package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Line;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.OrgPlanResponse;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.OrgUsage;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Subscription;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Usage;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The managed telephony plan. An organization calling through the platform's Telnyx line gets the plan's
 * minutes per calendar month (UTC), or its own. Only CONFIRMED calls count, each rounded up to a whole minute.
 * While the plan is not enforced no call is refused; usage is still recorded and shown.
 *
 * <p>Validation throws {@link IllegalArgumentException}, which the resources map to 400.
 */
@ApplicationScoped
public class TelephonyPlanService {

    private final TelephonyUsageStore store;
    private final Clock clock;

    @Inject
    public TelephonyPlanService(TelephonyUsageStore store) {
        this(store, Clock.systemUTC());
    }

    public TelephonyPlanService(TelephonyUsageStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    public Plan plan() {
        return store.plan();
    }

    public Plan setPlan(Plan req, String actor) {
        if (req == null || req.minutesPerMonth() < 0) {
            throw new IllegalArgumentException("minutesPerMonth is required and cannot be negative");
        }
        for (BigDecimal p : List.of(nz(req.clMobileUsd()), nz(req.clLandlineUsd()), nz(req.otherUsd()),
                nz(req.whatsappCallUsd()), nz(req.whatsappTemplateUsd()))) {
            if (p.signum() < 0) {
                throw new IllegalArgumentException("prices cannot be negative");
            }
        }
        return store.setPlan(new Plan(req.minutesPerMonth(), nz(req.clMobileUsd()), nz(req.clLandlineUsd()),
                nz(req.otherUsd()), nz(req.whatsappCallUsd()), nz(req.whatsappTemplateUsd()), req.enforced(), actor,
                null), actor);
    }

    public Subscription setSubscription(String tenantCode, Integer monthlyMinutes, String actor) {
        if (monthlyMinutes != null && monthlyMinutes < 0) {
            throw new IllegalArgumentException("monthlyMinutes cannot be negative");
        }
        store.saveSubscription(tenantCode, monthlyMinutes, actor);
        return store.subscription(tenantCode).orElse(new Subscription(monthlyMinutes, actor, null));
    }

    public int quota(String tenantCode) {
        Integer own = store.subscription(tenantCode).map(Subscription::monthlyMinutes).orElse(null);
        return own != null ? own : store.plan().minutesPerMonth();
    }

    /**
     * @throws TelephonyUnavailableException with {@code QUOTA_EXHAUSTED} when the plan is enforced and the
     *         organization used its minutes this month
     */
    public void requireMinutes(String tenantCode) {
        if (!store.plan().enforced()) {
            return;
        }
        YearMonth month = YearMonth.now(clock.withZone(ZoneOffset.UTC));
        long used = store.billedMinutes(tenantCode, start(month), start(month.plusMonths(1)));
        int quota = quota(tenantCode);
        if (used >= quota) {
            throw new TelephonyUnavailableException(TelephonyUnavailableException.QUOTA_EXHAUSTED,
                    "The organization used its " + quota + " minutes of managed calls this month");
        }
    }

    /** {@code month} null is the current one. The platform's provider cost is left out. */
    public OrgPlanResponse orgPlan(String tenantCode, YearMonth month) {
        return new OrgPlanResponse(store.plan(), store.subscription(tenantCode).orElse(null),
                usage(tenantCode, or(month)).withoutProviderCost());
    }

    public List<OrgUsage> allUsage(YearMonth month) {
        YearMonth m = or(month);
        return store.tenants(start(m), start(m.plusMonths(1))).stream()
                .map(t -> new OrgUsage(t, store.subscription(t).orElse(null), usage(t, m))).toList();
    }

    Usage usage(String tenantCode, YearMonth month) {
        Instant from = start(month);
        Instant to = start(month.plusMonths(1));
        Plan plan = store.plan();
        Map<String, long[]> counts = new LinkedHashMap<>();
        Map<String, BigDecimal> costs = new LinkedHashMap<>();
        long pending = 0;
        for (UsageRow r : store.rows(tenantCode, from, to)) {
            if (!UsageRow.CONFIRMED.equals(r.status())) {
                if (!UsageRow.EXPIRED.equals(r.status())) {
                    pending++;
                }
                continue;
            }
            String key = r.channel() + "|" + destination(r);
            long[] c = counts.computeIfAbsent(key, k -> new long[3]);
            c[0]++;
            c[1] += r.seconds() == null ? 0 : r.seconds();
            c[2] += r.billedMinutes() == null ? 0 : r.billedMinutes();
            if (r.providerCost() != null) {
                costs.merge(key, r.providerCost(), BigDecimal::add);
            }
        }
        List<Line> lines = new ArrayList<>();
        BigDecimal charge = BigDecimal.ZERO;
        BigDecimal cost = null;
        long voiceMinutes = 0;
        for (var e : counts.entrySet()) {
            String[] k = e.getKey().split("\\|", 2);
            long[] c = e.getValue();
            boolean perMessage = UsageRow.WHATSAPP_TEMPLATE.equals(k[0]);
            BigDecimal price = plan.price(UsageRow.VOICE.equals(k[0]) ? k[1] : k[0]);
            BigDecimal lineCharge = price.multiply(BigDecimal.valueOf(perMessage ? c[0] : c[2]));
            charge = charge.add(lineCharge);
            BigDecimal lineCost = costs.get(e.getKey());
            if (lineCost != null) {
                cost = cost == null ? lineCost : cost.add(lineCost);
            }
            if (UsageRow.VOICE.equals(k[0])) {
                voiceMinutes += c[2];
            }
            lines.add(new Line(k[0], k[1], c[0], c[1], c[2], lineCharge, lineCost));
        }
        return new Usage(from, to, quota(tenantCode), voiceMinutes, pending, charge, cost, lines);
    }

    private static String destination(UsageRow r) {
        return UsageRow.VOICE.equals(r.channel())
                ? (r.destinationType() == null ? TelephonyPlanDtos.OTHER : r.destinationType())
                : r.channel();
    }

    /** Chile: +56 9 and 8 digits is mobile, any other +56 number is a landline. */
    public static String destinationType(String e164) {
        String digits = e164 == null ? "" : e164.replaceAll("\\D", "");
        if (!digits.startsWith("56")) {
            return TelephonyPlanDtos.OTHER;
        }
        return digits.length() == 11 && digits.charAt(2) == '9' ? TelephonyPlanDtos.CL_MOBILE
                : TelephonyPlanDtos.CL_LANDLINE;
    }

    private YearMonth or(YearMonth month) {
        return month != null ? month : YearMonth.now(clock.withZone(ZoneOffset.UTC));
    }

    static Instant start(YearMonth month) {
        return month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
