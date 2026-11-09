package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.telephony.PstnCall;
import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Fills the duration and the result of the operator's Teams calls from the Microsoft Graph call records,
 * PSTN and Direct Routing alike. A record matches a CALL action only when all of these agree: the Microsoft user is the
 * operator, the callee is the number called, it started inside the call's window, and, when the line has
 * a default caller id, the caller is that number; the record must also be an outbound call. No match, or more than one, leaves the action pending:
 * Graph publishes records late, and a record of another operator must never be taken by number and time
 * alone. After {@link #GIVE_UP} without a record the action is marked NOT_FOUND. The operator's own request and
 * {@link TeamsCallReconcileJob} both run it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TeamsCallReconciler {

    static final Duration LOOKBACK = Duration.ofDays(7);
    static final Duration SLACK = Duration.ofMinutes(5);
    static final Duration GIVE_UP = Duration.ofHours(48);

    public static final String PENDING = "PENDING";
    public static final String RECORDED = "RECORDED";
    public static final String NOT_FOUND = "NOT_FOUND";

    /** {@code pending}: actions still waiting for their record after this run. */
    public record Result(int checked, int recorded, int pending) {
    }

    private final TreatmentStore treatments;
    private final Telephony telephony;
    private final AuditService audit;
    private final Clock clock;

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
     */
    public Result reconcile(String tenantCode, String operator) {
        Instant now = clock.instant();
        List<TreatmentAction> pending = treatments
                .pendingTelephonyCalls(tenantCode, operator, OffsetDateTime.ofInstant(now.minus(LOOKBACK),
                        ZoneOffset.UTC))
                .stream().filter(a -> "TEAMS_PHONE".equals(telephony(a).get("provider"))).toList();
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
        List<PstnCall> records = telephony.pstnCalls(tenantCode, line.connectionId(), from, to);
        Set<String> taken = new HashSet<>(treatments.recordedTelephonyRecordIds(tenantCode, line.connectionId()));
        int recorded = 0;
        int stillPending = 0;
        for (TreatmentAction action : pending) {
            List<PstnCall> matches = records.stream()
                    .filter(r -> key(r) != null && !taken.contains(key(r))
                            && matches(action, r, operator, line.callerNumber(), line.connectionId()))
                    .toList();
            Map<String, Object> t = new LinkedHashMap<>(telephony(action));
            t.putIfAbsent("connectionId", line.connectionId());
            t.put("lastCheckedAt", now.toString());
            t.put("attempts", attempts(t) + 1);
            boolean ambiguous = matches.size() > 1 || (matches.size() == 1 && pending.stream()
                    .filter(a -> matches(a, matches.get(0), operator, line.callerNumber(), line.connectionId()))
                    .limit(2).count() > 1);
            if (matches.size() == 1 && !ambiguous) {
                PstnCall r = matches.get(0);
                t.put("status", RECORDED);
                t.remove("reason");
                t.put("recordId", key(r));
                t.put("callId", r.callId());
                t.put("durationSeconds", r.durationSeconds());
                if (r.report() != null) {
                    t.put("report", r.report().name());
                }
                if (save(tenantCode, action, r.connected(), r.durationSeconds(), t)) {
                    taken.add(key(r));
                    audit.log(tenantCode, operator, "treatment.call_recorded", "treatment", action.treatmentId(), null,
                            Map.of("actionId", action.id(), "durationSeconds", r.durationSeconds()));
                    recorded++;
                }
                continue;
            }
            if (ambiguous) {
                t.put("reason", "AMBIGUOUS");
            } else {
                t.remove("reason");
            }
            if (Duration.between(endedAt(action), now).compareTo(GIVE_UP) > 0) {
                t.put("status", NOT_FOUND);
            }
            if (save(tenantCode, action, null, null, t) && PENDING.equals(t.get("status"))) {
                stillPending++;
            }
        }
        return new Result(pending.size(), recorded, stillPending);
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
