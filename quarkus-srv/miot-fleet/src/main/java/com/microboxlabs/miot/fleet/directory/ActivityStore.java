package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Hourly and daily activity of every asset, computed from GPS signals by {@link ActivityRollup}. */
public interface ActivityStore {

    /** Replaces these hours and recomputes the local days that contain them. */
    void saveHours(Instant from, Instant to, List<ActivityHour> hours, ZoneId zone);

    List<ActivityDay> days(String assetId, LocalDate from, LocalDate to);

    Map<String, ActivityTotals> totals(Collection<String> assetIds, LocalDate from, LocalDate to);

    Optional<Instant> cursor(String name);

    void cursor(String name, Instant value);

    /** Deletes hours before {@code hoursBefore} and days before {@code daysBefore}. */
    void prune(Instant hoursBefore, LocalDate daysBefore);
}
