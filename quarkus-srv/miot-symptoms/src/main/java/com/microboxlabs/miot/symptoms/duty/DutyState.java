package com.microboxlabs.miot.symptoms.duty;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Instant;

/**
 * One vehicle's driving and duty counters for one organization, after the last frame applied.
 *
 * @param at       the last frame applied
 * @param lat      its position
 * @param lon      its position
 * @param drive    the driving count of the trip in progress, or null without one
 * @param rest     the duty count of the trip in progress, or null without one or after a long rest
 * @param restarts the duty restarts already applied ({@link DutyStore#restartDuty})
 * @param skipped  the last frame not applied for an implied jump from {@code at}, or null
 * @param last     the counters of the last frame applied on a trip, kept after the trip ends; null in a state
 *                 written before it was kept
 * @param ended    {@code last} of the trip before it, kept for a case of that trip that closes on the next trip
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
@RegisterForReflection
public record DutyState(Instant at, double lat, double lon, Drive drive, Rest rest, long restarts, Fix skipped,
        Last last, Last ended) {

    public DutyState(Instant at, double lat, double lon, Drive drive, Rest rest, long restarts) {
        this(at, lat, lon, drive, rest, restarts, null, null, null);
    }

    public DutyState(Instant at, double lat, double lon, Drive drive, Rest rest, long restarts, Fix skipped) {
        this(at, lat, lon, drive, rest, restarts, skipped, null, null);
    }

    /** The state keeping {@code from}'s last counters of each trip. */
    public DutyState withTrips(DutyState from) {
        return from == null ? this
                : new DutyState(at, lat, lon, drive, rest, restarts, skipped, from.last(), from.ended());
    }

    /** The state after a frame applied on {@code value}'s trip: a new trip moves the last counters to ended. */
    public DutyState withLast(Last value) {
        Last before = last != null && !last.trip().equals(value.trip()) ? last : ended;
        return new DutyState(at, lat, lon, drive, rest, restarts, skipped, value, before);
    }

    /** The counters of the trip's last applied frame, or null when they are not kept. */
    public Last lastOf(String trip) {
        if (last != null && last.trip().equals(trip)) {
            return last;
        }
        return ended != null && ended.trip().equals(trip) ? ended : null;
    }

    /** What the check of a trip's last applied frame published, in minutes. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Last(String trip, double drivingMinutes, double restingMinutes, double dutyMinutes) {
    }

    /** A frame's time, position and trip; a missing trip in an older state is treated as unknown. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @RegisterForReflection
    public record Fix(Instant at, double lat, double lon, String trip) {

        public Fix(Instant at, double lat, double lon) {
            this(at, lat, lon, null);
        }
    }

    /**
     * Seconds of the driving count.
     *
     * @param trip       the trip it counts
     * @param moving     the last frame was moving
     * @param driven     driving of the finished driving runs
     * @param run        driving of the run in progress
     * @param paidBack   driving paid back by the finished stops
     * @param stopPays   what the stop in progress pays back
     * @param stopped    length of the stop in progress, from its first stopped frame
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Drive(String trip, boolean moving, double driven, double run, double paidBack, double stopPays,
            double stopped) {

        static Drive start(String trip, boolean moving, double run) {
            return new Drive(trip, moving, 0, run, 0, 0, 0);
        }

        /** Driving minus what the stops paid back. */
        double net() {
            return driven + run - (paidBack + stopPays);
        }
    }

    /**
     * The duty count.
     *
     * @param trip      the trip it counts
     * @param dutyS     seconds on duty, or null until the vehicle first moves
     * @param stopSince the first stopped frame of the stop in progress, or null while moving
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Rest(String trip, Double dutyS, Instant stopSince) {
    }
}
