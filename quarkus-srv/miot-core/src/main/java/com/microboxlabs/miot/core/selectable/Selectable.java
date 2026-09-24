package com.microboxlabs.miot.core.selectable;

import java.time.OffsetDateTime;
import java.util.List;

/** A named option list an organization can edit, such as the reasons a form field offers. */
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
