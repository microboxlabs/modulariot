package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;

/**
 * The organization's operator team, for the operator load card.
 *
 * @param operators        operators on duty per shift, or null when not set
 * @param shiftHours       length of a shift
 * @param capacityPerShift cases a shift can handle, or null when not set
 * @param updatedBy        who saved them last, or null when nothing was saved yet
 */
public record TowerSettings(
        String tenantCode,
        Integer operators,
        int shiftHours,
        Integer capacityPerShift,
        String updatedBy,
        OffsetDateTime updatedAt) {

    public static final int DEFAULT_SHIFT_HOURS = 8;

    /** What an organization that never saved its settings gets. */
    public static TowerSettings defaults(String tenantCode) {
        return new TowerSettings(tenantCode, null, DEFAULT_SHIFT_HOURS, null, null, null);
    }

    /** Shifts in a week, for turning weekly counts into counts per shift. */
    public double shiftsPerWeek() {
        return 7.0 * 24 / shiftHours;
    }
}
