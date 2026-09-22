package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;
import java.util.List;

/** A named option list behind one treatment-form field (call result, ignore reason, tags, ...). */
public record Selectable(
        String tenantCode,
        String key,
        String name,
        String description,
        SelectionMode mode,
        List<SelectableOption> options,
        String updatedBy,
        OffsetDateTime updatedAt) {
}
