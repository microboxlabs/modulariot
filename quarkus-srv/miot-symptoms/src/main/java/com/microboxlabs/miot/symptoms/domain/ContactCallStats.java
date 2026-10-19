package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;

/** Derived from {@code treatment_actions}: when a contact was last called and how often they answered. */
public record ContactCallStats(
        String contactId,
        OffsetDateTime lastCalledAt,
        long answered,
        long missed) {
}
