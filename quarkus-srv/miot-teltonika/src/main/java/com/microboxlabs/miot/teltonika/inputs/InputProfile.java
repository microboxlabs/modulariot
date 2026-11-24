package com.microboxlabs.miot.teltonika.inputs;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** An organization's input profile: one mapping per input, applied to the devices that use it. */
public record InputProfile(UUID id, String tenantCode, String name, String description, List<InputMapping> mappings,
        OffsetDateTime createdAt, String createdBy, OffsetDateTime updatedAt, String updatedBy) {

    public InputProfile {
        mappings = List.copyOf(mappings);
        Set<String> sources = new HashSet<>();
        for (InputMapping m : mappings) {
            if (!sources.add(m.source())) {
                throw new IllegalArgumentException("input " + m.source() + " is mapped twice");
            }
        }
    }
}
