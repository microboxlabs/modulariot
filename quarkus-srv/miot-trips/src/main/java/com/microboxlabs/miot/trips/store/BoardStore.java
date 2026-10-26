package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.BoardRow;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** The board's reads. {@code q} matches service codes, plates, driver, carrier, origin and destination. */
public interface BoardStore {

    /** Every planned or running trip of the tenant, from its hot row. */
    List<BoardRow> open(String tenantCode, String q);

    /**
     * Trips completed or cancelled between {@code from} and {@code to}: total counts and the newest
     * {@code perLane} rows of each finished lane. Truck and driver hold the ids of their last assignments.
     */
    FinishedPage finished(String tenantCode, String q, OffsetDateTime from, OffsetDateTime to, int perLane);

    record FinishedPage(List<BoardRow> rows, Map<String, Integer> counts) {
    }

    /** Open trips with only the state needed to classify their board view. */
    List<BoardRow> openForCounts(String tenantCode);

    /** How many trips were completed or cancelled between {@code from} and {@code to}. */
    int finishedCount(String tenantCode, OffsetDateTime from, OffsetDateTime to);

    /** One trip, open or finished. */
    Optional<BoardRow> trip(String tenantCode, UUID tripId);

    /** The feed service that maps to the trip: the row its source sent and the last reconcile. */
    Optional<FeedSource> feedSource(String tenantCode, UUID tripId);

    record FeedSource(String feedKey, String externalCode, Map<String, Object> source, String lastAction,
            String lastResult, OffsetDateTime lastReconciledAt) {
    }
}
