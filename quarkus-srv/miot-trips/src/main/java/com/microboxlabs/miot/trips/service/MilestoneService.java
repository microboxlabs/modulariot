package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.PendingMilestone;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.events.TripEventCatalog;
import com.microboxlabs.miot.trips.events.TripEvents;
import com.microboxlabs.miot.trips.store.MilestoneStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Departure, arrival and closure of trips. A detection only asks: it leaves the milestone pending. A confirmation is
 * audited as {@code milestone.confirmed}, which the monitor engine delivers to the trip's monitor as the command
 * {@code <milestone>_confirmed} at the confirmed time; a rejection likewise as {@code <milestone>_rejected}. The first
 * confirmation stays: a later one with another time is audited as {@code milestone.conflict} and changes nothing.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class MilestoneService {

    public static final String CONFIRMED = "milestone.confirmed";
    public static final String REJECTED = "milestone.rejected";
    public static final String CONFLICT = "milestone.conflict";
    public static final String REQUESTED = "milestone.requested";

    /** What a confirm or reject did. */
    public enum Result { CONFIRMED, UNCHANGED, CONFLICT, REJECTED, PENDING, SKIPPED }

    public record Outcome(TripMilestone milestone, Result result) {
    }

    /** Identifies the exact detection that a notice described. */
    public record DetectionRef(String milestone, OffsetDateTime proposedAt, String source) {
    }

    private final MilestoneStore store;
    private final TripStore trips;
    private final AuditService audit;
    private final TripEvents events;
    private final Transactions tx;
    private final Clock clock;

    @Inject
    public MilestoneService(MilestoneStore store, TripStore trips, AuditService audit, TripEvents events,
            Transactions tx) {
        this(store, trips, audit, events, tx, Clock.systemUTC());
    }

    /** Without trip events. */
    public MilestoneService(MilestoneStore store, TripStore trips, AuditService audit, Transactions tx) {
        this(store, trips, audit, TripEvents.NONE, tx, Clock.systemUTC());
    }

    public MilestoneService(MilestoneStore store, TripStore trips, AuditService audit, TripEvents events,
            Transactions tx, Clock clock) {
        this.store = store;
        this.trips = trips;
        this.audit = audit;
        this.events = events;
        this.tx = tx;
        this.clock = clock;
    }

    /** Every milestone of the trip, open ones included, in the order departure, arrival, closure. */
    public List<TripMilestone> list(String tenantCode, UUID tripId) {
        Map<String, TripMilestone> recorded = new LinkedHashMap<>();
        store.list(tenantCode, tripId).forEach(m -> recorded.put(m.milestone(), m));
        return TripMilestone.MILESTONES.stream()
                .map(m -> recorded.getOrDefault(m, TripMilestone.unrecorded(tenantCode, tripId.toString(), m)))
                .toList();
    }

    /** The organization's milestones waiting for a person, oldest detection first. */
    public List<PendingMilestone> pending(String tenantCode, Integer limit) {
        int n = limit == null ? 100 : limit;
        if (n < 1 || n > 500) {
            throw new IllegalArgumentException("limit must be between 1 and 500");
        }
        return store.pending(tenantCode, n);
    }

    /**
     * A detection asks for the milestone: it becomes pending with the time and evidence the detection gives. A
     * confirmed milestone is not asked again.
     */
    public Outcome request(String tenantCode, String actor, UUID tripId, String milestone, String source,
            OffsetDateTime proposedAt, Map<String, Object> evidence) {
        return request(tenantCode, actor, tripId, milestone, source, proposedAt, evidence, null);
    }

    /** Records which monitor rule detected the milestone when a rule made this request. */
    @SuppressWarnings("java:S107") // Extends the existing request with optional rule provenance.
    public Outcome request(String tenantCode, String actor, UUID tripId, String milestone, String source,
            OffsetDateTime proposedAt, Map<String, Object> evidence, String rule) {
        String m = milestone(milestone);
        return tx.inTransaction(() -> {
            Optional<TripMilestone> current = store.find(tenantCode, tripId, m);
            if (current.isPresent() && current.get().isConfirmed()) {
                return new Outcome(current.get(), Result.SKIPPED);
            }
            TripMilestone saved = store.save(new TripMilestone(tenantCode, tripId.toString(), m,
                    TripMilestone.PENDING, source, proposedAt, evidence, null, null, null, null, null, actor));
            audit.log(tenantCode, actor, REQUESTED, "trip", tripId.toString(), tripId.toString(),
                    details(m, proposedAt, null, source));
            events.milestone(TripEventCatalog.MILESTONE_DETECTED, tenantCode, tripId.toString(), instant(proposedAt),
                    new TripEvents.MilestoneNotice(m, source, instant(proposedAt), null, null, null, actor, rule));
            return new Outcome(saved, Result.PENDING);
        });
    }

    /**
     * Confirms the milestone at {@code at}; without it, at the time the pending detection proposed, else now. A
     * milestone already confirmed at the same time is unchanged; at another time it is a conflict.
     */
    public Outcome confirm(String tenantCode, String actor, UUID tripId, String milestone, OffsetDateTime at,
            String channel, String note) {
        String m = milestone(milestone);
        String ch = channel(channel);
        String n = Check.limitedOrNull(note, "note", 1000);
        return tx.inTransaction(() -> {
            existing(tenantCode, tripId);
            TripMilestone current = store.find(tenantCode, tripId, m)
                    .orElse(TripMilestone.unrecorded(tenantCode, tripId.toString(), m));
            OffsetDateTime when = utc(at != null ? at : proposedOrNow(current));
            if (current.isConfirmed()) {
                if (at == null || (current.confirmedAt() != null && current.confirmedAt().isEqual(when))) {
                    return new Outcome(current, Result.UNCHANGED);
                }
                Map<String, Object> d = details(m, when, ch, current.source());
                d.put("confirmedAt", current.confirmedAt().toString());
                d.put("confirmedBy", current.confirmedBy());
                audit.log(tenantCode, actor, CONFLICT, "trip", tripId.toString(), null, d);
                events.milestone(TripEventCatalog.MILESTONE_CONFLICT, tenantCode, tripId.toString(), now().toInstant(),
                        new TripEvents.MilestoneNotice(m, current.source(), instant(current.proposedAt()),
                                instant(current.confirmedAt()), when.toInstant(), ch, actor, null));
                return new Outcome(current, Result.CONFLICT);
            }
            TripMilestone saved = store.save(new TripMilestone(tenantCode, tripId.toString(), m,
                    TripMilestone.CONFIRMED, current.source(), current.proposedAt(), current.evidence(), when, actor,
                    ch, n, null, actor));
            audit.log(tenantCode, actor, CONFIRMED, "trip", tripId.toString(), tripId.toString(),
                    details(m, when, ch, current.source()));
            events.milestone(TripEventCatalog.MILESTONE_CONFIRMED, tenantCode, tripId.toString(), when.toInstant(),
                    new TripEvents.MilestoneNotice(m, current.source(), instant(current.proposedAt()),
                            when.toInstant(), null, ch, actor, null));
            return new Outcome(saved, Result.CONFIRMED);
        });
    }

    /** Marks a pending detection as a false positive; the next detection asks again. */
    public Outcome reject(String tenantCode, String actor, UUID tripId, String milestone, String channel,
            String note) {
        String m = milestone(milestone);
        String ch = channel(channel);
        String n = Check.limitedOrNull(note, "note", 1000);
        return tx.inTransaction(() -> {
            existing(tenantCode, tripId);
            TripMilestone current = store.find(tenantCode, tripId, m)
                    .orElse(TripMilestone.unrecorded(tenantCode, tripId.toString(), m));
            if (!current.isPending()) {
                throw new IllegalStateException("the " + m + " has no pending detection to reject");
            }
            TripMilestone saved = store.save(new TripMilestone(tenantCode, tripId.toString(), m,
                    TripMilestone.REJECTED, current.source(), current.proposedAt(), current.evidence(), null, actor,
                    ch, n, null, actor));
            audit.log(tenantCode, actor, REJECTED, "trip", tripId.toString(), tripId.toString(),
                    details(m, now(), ch, current.source()));
            events.milestone(TripEventCatalog.MILESTONE_REJECTED, tenantCode, tripId.toString(), now().toInstant(),
                    new TripEvents.MilestoneNotice(m, current.source(), instant(current.proposedAt()), null, null,
                            ch, actor, null));
            return new Outcome(saved, Result.REJECTED);
        });
    }

    /** Applies a reply only while its original detection is still pending. The check and update share one lock. */
    public Outcome respondToDetection(String tenantCode, String actor, UUID tripId, DetectionRef detection,
            boolean confirm) {
        return respondToDetection(tenantCode, actor, tripId, detection, confirm, "reply", null);
    }

    /** Applies a confirmation from a specific notice or pending-panel row. */
    public Outcome respondToDetection(String tenantCode, String actor, UUID tripId, DetectionRef detection,
            boolean confirm, String channel, String note) {
        String m = milestone(detection.milestone());
        return tx.inTransaction(() -> {
            existing(tenantCode, tripId);
            TripMilestone current = store.find(tenantCode, tripId, m)
                    .orElse(TripMilestone.unrecorded(tenantCode, tripId.toString(), m));
            if (!current.isPending() || current.proposedAt() == null || detection.proposedAt() == null
                    || !current.proposedAt().toInstant().truncatedTo(ChronoUnit.MICROS).equals(
                            detection.proposedAt().toInstant().truncatedTo(ChronoUnit.MICROS))
                    || !Objects.equals(current.source(), detection.source())) {
                return new Outcome(current, Result.SKIPPED);
            }
            return confirm ? confirm(tenantCode, actor, tripId, m, null, channel, note)
                    : reject(tenantCode, actor, tripId, m, channel, note);
        });
    }

    private void existing(String tenantCode, UUID tripId) {
        if (trips.find(tenantCode, tripId).isEmpty()) {
            throw new NoSuchElementException("trip not found");
        }
    }

    private static Map<String, Object> details(String milestone, OffsetDateTime at, String channel,
            String source) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("milestone", milestone);
        d.put("at", at.toString());
        if (channel != null) {
            d.put("channel", channel);
        }
        if (source != null) {
            d.put("source", source);
        }
        return d;
    }

    static String milestone(String milestone) {
        return Check.oneOf(milestone, "milestone", TripMilestone.MILESTONES.toArray(String[]::new));
    }

    private static String channel(String channel) {
        return Check.oneOf(channel, "channel", TripMilestone.CHANNELS.toArray(String[]::new));
    }

    private OffsetDateTime proposedOrNow(TripMilestone m) {
        return m.isPending() && m.proposedAt() != null ? m.proposedAt() : now();
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }

    private static java.time.Instant instant(OffsetDateTime t) {
        return t == null ? null : t.toInstant();
    }

    private static OffsetDateTime utc(OffsetDateTime t) {
        return t.withOffsetSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
    }
}
