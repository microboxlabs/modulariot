package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import java.time.OffsetDateTime;
import java.util.List;

/** A contact with its call history summary. */
public record ContactView(
        String id,
        String name,
        String role,
        String phone,
        List<CallMethod> methods,
        boolean active,
        String notes,
        OffsetDateTime lastCalledAt,
        long answered,
        long missed,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static ContactView of(Contact c, ContactCallStats stats) {
        return new ContactView(
                c.id(), c.name(), c.role(), c.phone(), c.methods(), c.active(), c.notes(),
                stats == null ? null : stats.lastCalledAt(),
                stats == null ? 0 : stats.answered(),
                stats == null ? 0 : stats.missed(),
                c.createdAt(), c.updatedAt());
    }
}
