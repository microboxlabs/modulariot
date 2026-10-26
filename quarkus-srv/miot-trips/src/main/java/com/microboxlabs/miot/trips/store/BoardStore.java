package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.BoardRow;
import java.time.OffsetDateTime;
import java.util.List;

/** The board's reads. {@code q} matches service codes, plates, driver, carrier, origin and destination. */
public interface BoardStore {

    /** Every planned or running trip of the tenant, from its hot row. */
    List<BoardRow> open(String tenantCode, String q);

    /**
     * Trips completed or cancelled between {@code from} and {@code to}, newest first, at most {@code limit}. Truck and
     * driver hold the resource ids of their last assignments.
     */
    List<BoardRow> finished(String tenantCode, String q, OffsetDateTime from, OffsetDateTime to, int limit);
}
