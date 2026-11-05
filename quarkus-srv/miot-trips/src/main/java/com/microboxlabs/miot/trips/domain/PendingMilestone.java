package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** A milestone waiting for a person, with the trip as people recognize it: its service and route. */
public record PendingMilestone(TripMilestone milestone, String serviceCode, String origin, String destination,
        OffsetDateTime plannedStart) {
}
