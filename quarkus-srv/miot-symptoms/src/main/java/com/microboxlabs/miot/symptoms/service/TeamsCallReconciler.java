package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.telephony.PstnCall;
import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.core.telephony.TelephonyThrottledException;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fills the duration and the result of the operator's Teams calls from the Microsoft Graph call records,
 * PSTN and Direct Routing alike. A record matches a CALL action only when all of these agree: the Microsoft user is the
 * operator, the callee is the number called, it started inside the call's window, and, when the line has
 * a default caller id, the caller is that number; the record must also be an outbound call. No match, or more than one, leaves the action pending:
 * Graph publishes records late, and a record of another operator must never be taken by number and time
 * alone. After {@link #GIVE_UP} without a record the action is marked NOT_FOUND. The operator's own request and
 * {@link TeamsCallReconcileJob} both run it. When Graph throttles an organization, its lookups wait the
 * {@code Retry-After} it gave, on this replica, before Graph is asked again.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TeamsCallReconciler {

    static final Duration LOOKBACK = Duration.ofDays(7);
    static final Duration SLACK = Duration.ofMinutes(5);
    static final Duration GIVE_UP = Duration.ofHours(48);
    static final int MAX_REPORT_LOOKUPS = 16;

    public static final String PENDING = "PENDING";
    public static final String RECORDED = "RECORDED";
    public static final String NOT_FOUND = "NOT_FOUND";
    private static final String STATUS = "status";
    private static final String REASON = "reason";

    /** {@code pending}: actions still waiting for their record after this run. */
    public record Result(int checked, int recorded, int pending) {
    }

    private final TreatmentStore treatments;
    private final Telephony telephony;
    private final AuditService audit;
    private final Clock clock;
    private final Map<String, Instant> throttledUntil = new ConcurrentHashMap<>();

    @Inject
    public TeamsCallReconciler(TreatmentStore treatments, Telephony telephony, AuditService audit) {
        this(treatments, telephony, audit, Clock.systemUTC());
    }

    public TeamsCallReconciler(TreatmentStore treatments, Telephony telephony, AuditService audit, Clock clock) {
        this.treatments = treatments;
        this.telephony = telephony;
        this.audit = audit;
        this.clock = clock;
    }

    /**
     * @throws TelephonyUnavailableException when the organization has no ready Teams Phone line, or Graph refuses
     * @throws TelephonyThrottledException   when Graph throttles the organization, or it is still waiting
     */
    public Result reconcile(String tenantCode, String operator) {
        return reconcileOperators(tenantCode, List.of(operator));
    }

    /** One complete Graph lookup shared by the organization's pending operators. */
    Result reconcileOperators(String tenantCode, List<String> operators) {
        Instant now = clock.instant();
        OffsetDateTime since = OffsetDateTime.ofInstant(now.minus(LOOKBACK), ZoneOffset.UTC);
        List<TreatmentAction> pending = operators.stream().distinct()
                .flatMap(operator -> treatments.pendingTelephonyCalls(tenantCode, operator, since).stream())
                .filter(a -> "TEAMS_PHONE".equals(telephony(a).get("provider"))).toList();
        if (pending.isEmpty()) {
            return new Result(0, 0, 0);
        }
        TelephonyLine line = telephony.lines(tenantCode).stream()
                .filter(l -> l.provider() == TelephonyProvider.TEAMS_PHONE && l.ready()).findFirst()
                .orElseThrow(() -> new TelephonyUnavailableException("The organization has no ready Teams Phone line"));
        Instant from = pending.stream().map(TeamsCallReconciler::startedAt).min(Instant::compareTo).orElseThrow()
                .minus(SLACK);
        Instant to = pending.stream().map(TeamsCallReconciler::endedAt).max(Instant::compareTo).orElseThrow()
                .plus(SLACK);
        if (to.isAfter(now)) {
            to = now;
        }
        List<PstnCall> records = lookup(tenantCode, line.connectionId(), from, to, now);
        Set<String> taken = new HashSet<>(treatments.recordedTelephonyRecordIds(tenantCode, line.connectionId()));
        Lookup lookup = new Lookup(line, records, pending, taken);
        int recorded = 0;
        int stillPending = 0;
        for (TreatmentAction action : pending) {
            Result result = reconcileAction(tenantCode, now, lookup, action);
            recorded += result.recorded();
            stillPending += result.pending();
        }
        return new Result(pending.size(), recorded, stillPending);
    }

    /** Whether Graph asked this organization to wait and the wait has not passed. */
    boolean throttled(String tenantCode) {
        Instant until = throttledUntil.get(tenantCode);
        if (until == null) {
            return false;
        }
        if (clock.instant().isBefore(until)) {
            return true;
        }
        throttledUntil.remove(tenantCode, until);
        return false;
    }

    private List<PstnCall> lookup(String tenantCode, String connectionId, Instant from, Instant to, Instant now) {
        Instant until = throttledUntil.get(tenantCode);
        if (until != null && now.isBefore(until)) {
            throw new TelephonyThrottledException("Microsoft Graph asked to wait before the next lookup",
                    Duration.between(now, until));
        }
        try {
            return new ReportScan().read(tenantCode, connectionId, from, to);
        } catch (TelephonyThrottledException e) {
            throttledUntil.merge(tenantCode, now.plus(e.retryAfter()), (a, b) -> a.isAfter(b) ? a : b);
            throw e;
        }
    }

    /** Split only a page-limit failure; every subwindow must complete before any record is assigned. */
    private final class ReportScan {
        private int remaining = MAX_REPORT_LOOKUPS;

        List<PstnCall> read(String tenantCode, String connectionId, Instant from, Instant to) {
            remaining--;
            try {
                return telephony.pstnCalls(tenantCode, connectionId, from, to);
            } catch (TelephonyUnavailableException tooLarge) {
                if (!TelephonyUnavailableException.CALL_RECORDS_PAGE_LIMIT.equals(tooLarge.code())) {
                    throw tooLarge;
                }
                Instant middle = from.plus(Duration.between(from, to).dividedBy(2)).truncatedTo(ChronoUnit.SECONDS);
                if (remaining < 2 || !middle.isAfter(from) || !middle.isBefore(to)) {
                    throw tooLarge;
                }
                List<PstnCall> calls = new ArrayList<>(read(tenantCode, connectionId, from, middle));
                // A left-hand split may have consumed the remaining budget.
                if (remaining == 0) {
                    throw tooLarge;
                }
                calls.addAll(read(tenantCode, connectionId, middle, to));
                return distinctRecords(calls);
            }
        }
    }

    private record RecordKey(PstnCall.Report report, String id) {
    }

    /** PSTN includes both time bounds, so split responses may repeat the same report row. */
    private static List<PstnCall> distinctRecords(List<PstnCall> calls) {
        Map<RecordKey, PstnCall> distinct = new LinkedHashMap<>();
        for (PstnCall call : calls) {
            String id = key(call);
            if (id != null) {
                distinct.put(new RecordKey(call.report(), id), call);
            }
        }
        return List.copyOf(distinct.values());
    }

    private record Lookup(TelephonyLine line, List<PstnCall> records, List<TreatmentAction> pending, Set<String> taken) {
    }

    private Result reconcileAction(String tenantCode, Instant now, Lookup lookup, TreatmentAction action) {
        TelephonyLine line = lookup.line();
        String operator = action.performedBy();
        List<PstnCall> matches = lookup.records().stream()
                .filter(r -> key(r) != null && !lookup.taken().contains(key(r))
                        && matches(action, r, operator, line.callerNumber(), line.connectionId()))
                .toList();
        Map<String, Object> t = new LinkedHashMap<>(telephony(action));
        t.putIfAbsent("connectionId", line.connectionId());
        t.put("lastCheckedAt", now.toString());
        t.put("attempts", attempts(t) + 1);
        boolean ambiguous = ambiguous(matches, lookup);
        if (matches.size() == 1 && !ambiguous) {
            return recordCall(tenantCode, lookup, action, matches.get(0), t);
        }
        if (ambiguous) {
            t.put(REASON, "AMBIGUOUS");
        } else {
            t.remove(REASON);
        }
        if (Duration.between(endedAt(action), now).compareTo(GIVE_UP) > 0) {
            t.put(STATUS, NOT_FOUND);
        }
        boolean pending = save(tenantCode, action, null, null, t) && PENDING.equals(t.get(STATUS));
        return new Result(1, 0, pending ? 1 : 0);
    }

    private static boolean ambiguous(List<PstnCall> matches, Lookup lookup) {
        return matches.size() > 1 || (matches.size() == 1 && lookup.pending().stream()
                .filter(a -> matches(a, matches.get(0), a.performedBy(), lookup.line().callerNumber(),
                        lookup.line().connectionId()))
                .limit(2).count() > 1);
    }

    private Result recordCall(String tenantCode, Lookup lookup, TreatmentAction action, PstnCall call,
            Map<String, Object> t) {
        t.put(STATUS, RECORDED);
        t.remove(REASON);
        t.put("recordId", key(call));
        t.put("callId", call.callId());
        t.put("durationSeconds", call.durationSeconds());
        if (call.report() != null) {
            t.put("report", call.report().name());
        }
        if (!save(tenantCode, action, call.connected(), call.durationSeconds(), t)) {
            return new Result(1, 0, 0);
        }
        lookup.taken().add(key(call));
        audit.log(tenantCode, action.performedBy(), "treatment.call_recorded", "treatment", action.treatmentId(), null,
                Map.of("actionId", action.id(), "durationSeconds", call.durationSeconds()));
        return new Result(1, 1, 0);
    }

    static boolean matches(TreatmentAction action, PstnCall r, String operator, String lineCaller, String connectionId) {
        Object originalConnection = telephony(action).get("connectionId");
        if (originalConnection != null && !connectionId.equals(originalConnection)) {
            return false;
        }
        if (!r.outbound()) {
            return false;
        }
        String callee = digits(telephony(action).get("calleeNumber"));
        if (callee == null || !callee.equals(digits(r.calleeNumber()))) {
            return false;
        }
        if (r.userPrincipalName() == null
                || !r.userPrincipalName().trim().toLowerCase(Locale.ROOT)
                        .equals(operator.trim().toLowerCase(Locale.ROOT))) {
            return false;
        }
        if (lineCaller != null && !digits(lineCaller).equals(digits(r.callerNumber()))) {
            return false;
        }
        Instant start = r.start();
        return start != null && !start.isBefore(startedAt(action).minus(SLACK))
                && !start.isAfter(endedAt(action).plus(SLACK));
    }

    private boolean save(String tenantCode, TreatmentAction action, Boolean answered, Integer seconds,
            Map<String, Object> t) {
        Map<String, Object> details = new LinkedHashMap<>(action.details() == null ? Map.of() : action.details());
        details.put("telephony", t);
        return treatments.updateCallResult(tenantCode, action.id(), answered, seconds, details).isPresent();
    }

    private static String key(PstnCall r) {
        return r.id() != null ? r.id() : r.callId();
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> telephony(TreatmentAction a) {
        Object t = a.details() == null ? null : a.details().get("telephony");
        return t instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    private static int attempts(Map<String, Object> t) {
        return t.get("attempts") instanceof Number n ? n.intValue() : 0;
    }

    /** When the call started: as the app reported it, else the save time less the timed duration. */
    static Instant startedAt(TreatmentAction a) {
        Instant at = instant(telephony(a).get("startedAt"));
        if (at != null) {
            return at;
        }
        int seconds = a.durationSeconds() == null ? 0 : a.durationSeconds();
        return a.performedAt().toInstant().minusSeconds(seconds);
    }

    static Instant endedAt(TreatmentAction a) {
        Instant at = instant(telephony(a).get("endedAt"));
        return at != null ? at : a.performedAt().toInstant();
    }

    private static Instant instant(Object value) {
        try {
            return value == null ? null : Instant.parse(value.toString());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String digits(Object value) {
        if (value == null) {
            return null;
        }
        String d = value.toString().replaceAll("\\D", "");
        return d.isEmpty() ? null : d;
    }
}
