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

    /**
     * The trip's orders, its first two drivers, the carrier of its last truck, and the types of its origin and
     * destination.
     */
    Optional<TripDetails> details(String tenantCode, UUID tripId);

    record TripDetails(List<Order> orders, List<Driver> drivers, Carrier carrier, String originType,
            String destinationType) {
    }

    /**
     * {@code phone} is the mobile phone, else the other one. {@code validations} are the driver's fleet attributes
     * in force, as external systems report them.
     */
    record Driver(String name, String rut, String phone, List<Validation> validations) {
        public Driver {
            validations = validations == null ? List.of() : List.copyOf(validations);
        }
    }

    /** {@code validUntil} is an ISO instant, null when it does not expire. */
    record Validation(String type, String key, String value, String source, String validUntil) {
    }

    /** A mandate the trip serves: its code, service type and reference. */
    record Order(String code, String orderType, String orderRef) {
    }

    /** {@code code} is the carrier's id in the source system. */
    record Carrier(String name, String rut, String code) {
    }
}
