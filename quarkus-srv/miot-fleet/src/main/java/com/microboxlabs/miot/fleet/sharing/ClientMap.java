package com.microboxlabs.miot.fleet.sharing;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The rows of {@code asset_client_map} that the data shares own, and how to bring the table in line with them. Rows
 * loaded by hand or by the db-writer's sender auto-assignment are never part of this.
 */
public final class ClientMap {

    /** Written for a share without an end, as the db-writer does for its own open-ended rows. */
    public static final Instant NO_END = Instant.parse("2099-12-31T00:00:00Z");

    private ClientMap() {
    }

    /** {@code validTo} null means no end. Times keep microseconds, as Postgres stores them. */
    public record Row(String assetId, String clientId, Instant validFrom, Instant validTo) {

        public Row {
            validFrom = micros(validFrom);
            validTo = micros(validTo);
        }

        public String key() {
            return assetId + "\u0000" + clientId;
        }

        /** The window covering both rows: earliest start, latest end. */
        public Row widen(Row other) {
            Instant from = validFrom.isBefore(other.validFrom) ? validFrom : other.validFrom;
            return new Row(assetId, clientId, from, laterEnd(validTo, other.validTo));
        }

        /** The end as stored, where no end is {@link #NO_END}. */
        public Instant storedTo() {
            return validTo == null ? NO_END : validTo;
        }
    }

    private static Instant laterEnd(Instant a, Instant b) {
        if (a == null || b == null) {
            return null;
        }
        return a.isAfter(b) ? a : b;
    }

    private static Instant micros(Instant at) {
        return at == null ? null : at.truncatedTo(ChronoUnit.MICROS);
    }

    public record Plan(List<Row> insert, List<Row> update, List<Row> delete) {

        public boolean isEmpty() {
            return insert.isEmpty() && update.isEmpty() && delete.isEmpty();
        }
    }

    /** {@code existing} as read back, with the stored end; {@code desired} as computed, with null for no end. */
    public static Plan plan(Collection<Row> desired, Collection<Row> existing) {
        Map<String, Row> current = new HashMap<>();
        existing.forEach(r -> current.put(r.key(), r));
        List<Row> insert = new ArrayList<>();
        List<Row> update = new ArrayList<>();
        for (Row want : desired) {
            Row have = current.remove(want.key());
            if (have == null) {
                insert.add(want);
            } else if (!Objects.equals(have.validFrom(), want.validFrom())
                    || !Objects.equals(have.storedTo(), want.storedTo())) {
                update.add(want);
            }
        }
        return new Plan(insert, update, new ArrayList<>(current.values()));
    }
}
