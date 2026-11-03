package com.microboxlabs.miot.symptoms.cases;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.store.SymptomCatalogStore;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.IgnoreHolds;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;

/**
 * "Ignorar condición" on an engine case: the {@code IGNORE} action puts the case on hold, and the hold ends when
 * its time runs out, when the trip ends, or when an operator lifts it ("Reanudar").
 *
 * <p>While on hold the case is out of the active list and counts, its SLA counts as attended and its level does
 * not rise; a new case in the hold's scope does not open ({@link HoldIndex}). When the hold ends the treatment
 * closes with one of {@link #ENDINGS}: the case had closed by its symptom's close rule
 * ({@value #RESOLVED}), it is still open and back in the tower at its level ({@value #RETURNED}), or the trip
 * ended and the held cases closed ({@value #IGNORED}).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class HoldService implements IgnoreHolds {

    public static final String SCOPE = "scope";
    public static final String UNTIL_TRIP_END = "until_trip_end";
    public static final String RESOLVED = "resolved_after_ignore";
    public static final String RETURNED = "returned_after_ignore";
    public static final String IGNORED = "ignored";
    public static final Set<String> ENDINGS = Set.of(RESOLVED, RETURNED, IGNORED);
    /** Who ends a hold whose time ran out or whose trip ended. */
    public static final String SYSTEM = "system";
    /** The longest timed hold. */
    static final Duration MAX = Duration.ofHours(24);
    private static final String ENTITY = "treatment";

    /** Why a hold ends. */
    public enum End {
        EXPIRED,
        RESUMED,
        TRIP_ENDED,
        CASE_CLOSED
    }

    private final EngineCaseStore cases;
    private final EngineCaseService caseService;
    private final HoldStore holds;
    private final HoldIndex index;
    private final TreatmentStore treatments;
    private final AuditService audit;
    private final Policies policies;
    private final Clock clock;

    /** The "ignore" policy of a case's level in the version that opened it; null for the default. */
    @FunctionalInterface
    public interface Policies {
        SymptomSpec.Ignore of(String tenantCode, EngineCase c);
    }

    @Inject
    HoldService(EngineCaseStore cases, EngineCaseService caseService, HoldStore holds, HoldIndex index,
            TreatmentStore treatments, AuditService audit, SymptomCatalogStore catalog) {
        this(cases, caseService, holds, index, treatments, audit, (tenant, c) -> policy(catalog, tenant, c),
                Clock.systemUTC());
    }

    @SuppressWarnings("java:S107") // The collaborators above, with the policy lookup and the clock for tests.
    public HoldService(EngineCaseStore cases, EngineCaseService caseService, HoldStore holds, HoldIndex index,
            TreatmentStore treatments, AuditService audit, Policies policies, Clock clock) {
        this.cases = cases;
        this.caseService = caseService;
        this.holds = holds;
        this.index = index;
        this.treatments = treatments;
        this.audit = audit;
        this.policies = policies;
        this.clock = clock;
    }

    private static SymptomSpec.Ignore policy(SymptomCatalogStore catalog, String tenant, EngineCase c) {
        return catalog.findVersion(tenant, c.definitionId(), c.version()).map(SymptomVersion::spec)
                .map(SymptomSpec::levels).orElse(List.of()).stream()
                .filter(l -> l.icu() == c.level()).findFirst().map(SymptomSpec.Level::ignore).orElse(null);
    }

    /**
     * An {@code IGNORE} on an engine case: the case is open and on no hold, and the request keeps to its level's
     * policy. {@code details.scope} is CASE (default), SYMPTOM or ALL; {@code details.until_trip_end} holds the
     * case until its trip ends, else {@code durationSeconds} (at most a day) does. The stored details add the
     * case's level and condition at that moment. Other symptoms are recorded as sent.
     */
    @Override
    public Checked check(String tenantCode, Treatment treatment, AddActionRequest req) {
        Map<String, Object> sent = req.details() == null ? Map.of() : req.details();
        Optional<Long> caseId = EngineCase.caseId(treatment.symptomId()).stream().boxed().findFirst();
        if (caseId.isEmpty()) {
            return new Checked(req.durationSeconds(), sent);
        }
        EngineCase c = cases.find(tenantCode, caseId.get())
                .orElseThrow(() -> new NoSuchElementException("Symptom not found"));
        if (c.closedAt() != null) {
            throw new IllegalStateException("the case is closed");
        }
        if (c.ignored() != null) {
            throw new IllegalStateException("the case is already ignored");
        }
        SymptomSpec.Ignore policy = policies.of(tenantCode, c);
        if (policy != null && Boolean.FALSE.equals(policy.allowed())) {
            throw new IllegalArgumentException("ignoring is not allowed at level " + c.level());
        }
        IgnoreHold.Scope scope = IgnoreHold.Scope.parse(sent.get(SCOPE));
        if (policy != null && policy.scopes() != null && !policy.scopes().contains(scope.name())) {
            throw new IllegalArgumentException("scope " + scope + " is not allowed at level " + c.level());
        }
        Duration max = policy == null ? null : policy.maxDurationValue();
        boolean tripEnd = Boolean.TRUE.equals(sent.get(UNTIL_TRIP_END))
                || "true".equals(String.valueOf(sent.get(UNTIL_TRIP_END)));
        Integer duration = tripEnd ? null : req.durationSeconds();
        if (tripEnd) {
            tripEnd(tenantCode, c, max);
        } else if (duration == null || duration <= 0) {
            throw new IllegalArgumentException("an IGNORE needs durationSeconds > 0 or details.until_trip_end");
        } else if (duration > MAX.toSeconds() || (max != null && duration > max.toSeconds())) {
            throw new IllegalArgumentException("the longest hold at level " + c.level() + " is "
                    + (max != null && max.compareTo(MAX) < 0 ? max : MAX).toMinutes() + " minutes");
        }
        boolean noteRequired = (policy != null && Boolean.TRUE.equals(policy.noteRequired())) || other(req);
        if (noteRequired && (req.note() == null || req.note().isBlank())) {
            throw new IllegalArgumentException("a note is required");
        }
        Map<String, Object> details = new LinkedHashMap<>(sent);
        details.put(SCOPE, scope.name());
        details.put(UNTIL_TRIP_END, tripEnd);
        details.put("case_level", c.level());
        details.put("case_condition", c.treatments() > 0 ? "UNDER TREATMENT" : "LEVEL " + c.level());
        if (!tripEnd) {
            details.put("until", clock.instant().plusSeconds(duration).toString());
        }
        return new Checked(duration, details);
    }

    private void tripEnd(String tenantCode, EngineCase c, Duration max) {
        if (max != null) {
            throw new IllegalArgumentException("level " + c.level() + " allows at most " + max.toMinutes()
                    + " minutes, not until the trip ends");
        }
        if (c.tripId() == null || !holds.tripLive(tenantCode, c.tripId(), c.assetId()).orElse(false)) {
            throw new IllegalArgumentException("the case has no running trip to wait for");
        }
    }

    /** "Otro": the reason list's free-text option. */
    static boolean other(AddActionRequest req) {
        String key = req.outcomeKey() == null ? "" : req.outcomeKey().trim().toLowerCase(Locale.ROOT);
        String label = req.outcomeLabel() == null ? "" : req.outcomeLabel().trim().toLowerCase(Locale.ROOT);
        return key.equals("ignore_reason_6") || key.endsWith("_other") || key.equals("other")
                || label.startsWith("otro") || label.startsWith("other");
    }

    @Override
    public void changed(String tenantCode) {
        index.changed(tenantCode);
    }

    /**
     * "Reanudar": an operator lifts the hold before it ends, which then ends as when its time runs out.
     *
     * @throws NoSuchElementException when the treatment does not exist
     * @throws IllegalStateException when it is not an open hold
     */
    public Treatment resume(String tenantCode, String actor, String treatmentId) {
        IgnoreHold h = holds.find(tenantCode, treatmentId).orElseThrow(() -> treatments.find(tenantCode, treatmentId)
                .<RuntimeException>map(t -> new IllegalStateException("the treatment is not on hold"))
                .orElseGet(() -> new NoSuchElementException("treatment not found")));
        return end(h, actor, End.RESUMED).orElseThrow(() -> new IllegalStateException("the hold already ended"));
    }

    /**
     * Ends the hold: with the trip, the open cases it covers close; then the treatment closes with the outcome.
     * Empty when another call ended it first.
     */
    public Optional<Treatment> end(IgnoreHold h, String actor, End why) {
        String tenant = h.tenantCode();
        String resolution;
        if (why == End.TRIP_ENDED) {
            closeCovered(h, actor);
            resolution = IGNORED;
        } else {
            boolean closed = cases.find(tenant, h.caseId()).map(c -> c.closedAt() != null).orElse(true);
            resolution = closed ? RESOLVED : RETURNED;
        }
        Optional<Treatment> ended = treatments.transition(tenant, h.id(), TreatmentStatus.CLOSED, actor, resolution,
                null, clock.instant().atOffset(ZoneOffset.UTC));
        index.changed(tenant);
        ended.ifPresent(t -> audit.log(tenant, actor, "treatment.hold_ended", ENTITY, t.id(), t.symptomId(),
                Map.of("reason", why.name(), "resolution", resolution, SCOPE, h.scope().name())));
        return ended;
    }

    /** The trip ended: the ignored case and, by scope, the vehicle's other open cases close. */
    private void closeCovered(IgnoreHold h, String actor) {
        caseService.close(h.tenantCode(), -h.caseId(), actor);
        if (h.scope() == IgnoreHold.Scope.CASE) {
            return;
        }
        EngineCaseStore.CaseFilter filter = new EngineCaseStore.CaseFilter(null, h.assetId(), null, null, null,
                null).withIgnored();
        for (EngineCase c : cases.list(h.tenantCode(), filter)) {
            if (c.assetId().equals(h.assetId()) && c.id() != h.caseId() && c.closedAt() == null
                    && (h.scope() == IgnoreHold.Scope.ALL || c.definitionId().equals(h.definitionId()))) {
                caseService.close(h.tenantCode(), c.symptomId(), actor);
            }
        }
    }

    /**
     * One pass of the timer: ends each open hold whose time ran out, whose trip ended, or (scope CASE) whose case
     * closed. Returns the holds it ended.
     */
    public int endDue(int limit) {
        Instant now = clock.instant();
        int ended = 0;
        for (IgnoreHold h : holds.open(limit)) {
            End why = due(h, now);
            if (why != null && end(h, SYSTEM, why).isPresent()) {
                ended++;
            }
        }
        return ended;
    }

    private End due(IgnoreHold h, Instant now) {
        if (h.scope() == IgnoreHold.Scope.CASE && h.caseClosed()) {
            return End.CASE_CLOSED;
        }
        if (!h.untilTripEnd()) {
            return h.activeAt(now) ? null : End.EXPIRED;
        }
        if (h.tripId() == null) {
            return End.TRIP_ENDED;
        }
        return Boolean.FALSE.equals(holds.tripLive(h.tenantCode(), h.tripId(), h.assetId()).orElse(null))
                ? End.TRIP_ENDED : null;
    }
}
