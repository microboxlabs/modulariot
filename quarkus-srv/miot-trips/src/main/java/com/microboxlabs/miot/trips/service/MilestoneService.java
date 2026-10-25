package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.store.MilestoneStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
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

    private final MilestoneStore store;
    private final TripStore trips;
    private final AuditService audit;
    private final Transactions tx;
    private final Clock clock;

    @Inject
    public MilestoneService(MilestoneStore store, TripStore trips, AuditService audit, Transactions tx) {
        this(store, trips, audit, tx, Clock.systemUTC());
    }

    public MilestoneService(MilestoneStore store, TripStore trips, AuditService audit, Transactions tx,
            Clock clock) {
        this.store = store;
        this.trips = trips;
        this.audit = audit;
        this.tx = tx;
        this.clock = clock;
    }

    /** Every milestone of the trip, open ones included, in the order departure, arrival, closure. */
    public List<TripMilestone> list(String tenantCode, UUID tripId) {
        Map<String, TripMilestone> recorded = new LinkedHashMap<>();
        store.list(tenantCode, tripId).forEach(m -> recorded.put(m.milestone(), m));
        return TripMilestone.MILESTONES.stream()
                .map(m -> recorded.getOrDefault(m, TripMilestone.open(tenantCode, tripId.toString(), m)))
                .toList();
    }

    /**
     * A detection asks for the milestone: it becomes pending with the time and evidence the detection gives. A
     * confirmed milestone is not asked again.
     */
    public Outcome request(String tenantCode, String actor, UUID tripId, String milestone, String source,
            OffsetDateTime proposedAt, Map<String, Object> evidence) {
        String m = milestone(milestone);
        return tx.inTransaction(() -> {
            Optional<TripMilestone> current = store.find(tenantCode, tripId, m);
            if (current.isPresent() && current.get().confirmed()) {
                return new Outcome(current.get(), Result.SKIPPED);
            }
            TripMilestone saved = store.save(new TripMilestone(tenantCode, tripId.toString(), m,
                    TripMilestone.PENDING, source, proposedAt, evidence, null, null, null, null, null, actor));
            audit.log(tenantCode, actor, REQUESTED, "trip", tripId.toString(), tripId.toString(),
                    details(m, proposedAt, null, source));
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
                    .orElse(TripMilestone.open(tenantCode, tripId.toString(), m));
            OffsetDateTime when = utc(at != null ? at : proposedOrNow(current));
            if (current.confirmed()) {
                if (current.confirmedAt() != null && current.confirmedAt().isEqual(when)) {
                    return new Outcome(current, Result.UNCHANGED);
                }
                Map<String, Object> d = details(m, when, ch, current.source());
                d.put("confirmedAt", current.confirmedAt().toString());
                d.put("confirmedBy", current.confirmedBy());
                audit.log(tenantCode, actor, CONFLICT, "trip", tripId.toString(), null, d);
                return new Outcome(current, Result.CONFLICT);
            }
            TripMilestone saved = store.save(new TripMilestone(tenantCode, tripId.toString(), m,
                    TripMilestone.CONFIRMED, current.source(), current.proposedAt(), current.evidence(), when, actor,
                    ch, n, null, actor));
            audit.log(tenantCode, actor, CONFIRMED, "trip", tripId.toString(), tripId.toString(),
                    details(m, when, ch, current.source()));
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
                    .orElse(TripMilestone.open(tenantCode, tripId.toString(), m));
            if (!current.pending()) {
                throw new IllegalStateException("the " + m + " has no pending detection to reject");
            }
            TripMilestone saved = store.save(new TripMilestone(tenantCode, tripId.toString(), m,
                    TripMilestone.REJECTED, current.source(), current.proposedAt(), current.evidence(), null, actor,
                    ch, n, null, actor));
            audit.log(tenantCode, actor, REJECTED, "trip", tripId.toString(), tripId.toString(),
                    details(m, now(), ch, current.source()));
            return new Outcome(saved, Result.REJECTED);
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
        return m.pending() && m.proposedAt() != null ? m.proposedAt() : now();
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }

    private static OffsetDateTime utc(OffsetDateTime t) {
        return t.withOffsetSameInstant(ZoneOffset.UTC);
    }
}
