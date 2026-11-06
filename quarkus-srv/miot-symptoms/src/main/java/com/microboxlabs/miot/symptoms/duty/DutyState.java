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
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
@RegisterForReflection
public record DutyState(Instant at, double lat, double lon, Drive drive, Rest rest, long restarts) {

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
