package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * A point of a trip a person confirms: its departure, its arrival or its closure. A detection (GPS, ETA) leaves it
 * {@value #PENDING} with the time it proposes; a confirmation from the feed, a notice reply or the UI makes it
 * {@value #CONFIRMED}; a rejection marks the detection as a false positive. {@value #OPEN} is a milestone with
 * nothing recorded yet.
 */
public record TripMilestone(
        String tenantCode,
        String tripId,
        String milestone,
        String status,
        String source,
        OffsetDateTime proposedAt,
        Map<String, Object> evidence,
        OffsetDateTime confirmedAt,
        String confirmedBy,
        String channel,
        String note,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String DEPARTURE = "departure";
    public static final String ARRIVAL = "arrival";
    public static final String CLOSURE = "closure";
    public static final List<String> MILESTONES = List.of(DEPARTURE, ARRIVAL, CLOSURE);

    public static final String OPEN = "open";
    public static final String PENDING = "pending";
    public static final String CONFIRMED = "confirmed";
    public static final String REJECTED = "rejected";

    /** Where a confirmation or rejection came from. */
    public static final List<String> CHANNELS = List.of("feed", "reply", "ui", "api");

    public TripMilestone {
        evidence = evidence == null ? Map.of() : Map.copyOf(evidence);
    }

    /** A milestone with nothing recorded. */
    public static TripMilestone unrecorded(String tenantCode, String tripId, String milestone) {
        return new TripMilestone(tenantCode, tripId, milestone, OPEN, null, null, Map.of(), null, null, null, null,
                null, null);
    }

    public boolean isConfirmed() {
        return CONFIRMED.equals(status);
    }

    public boolean isPending() {
        return PENDING.equals(status);
    }
}
