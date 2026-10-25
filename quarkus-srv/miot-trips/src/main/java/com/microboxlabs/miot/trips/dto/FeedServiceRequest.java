package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The desired state of one external service, as a feed sends it. Resources are named by their natural keys (plate,
 * document); the trips module resolves them in fleet. {@code origin} and {@code destination} are the source's names
 * for the places, matched as sent against the locations' external codes; an unknown one creates the location.
 * {@code actualStart}, {@code actualArrival} and {@code actualEnd} are the departure, arrival and closure a person
 * recorded at the source; each confirms that milestone of the trip. {@code source} is the original record (a
 * spreadsheet row), kept for audit and not compared.
 */
public record FeedServiceRequest(
        String orderType,
        String orderRef,
        String origin,
        String destination,
        OffsetDateTime plannedStart,
        OffsetDateTime plannedEnd,
        OffsetDateTime actualStart,
        OffsetDateTime actualArrival,
        OffsetDateTime actualEnd,
        Resources resources,
        JsonNode source) {

    public FeedServiceRequest(String orderType, String orderRef, String origin, String destination,
            OffsetDateTime plannedStart, OffsetDateTime plannedEnd, Resources resources, JsonNode source) {
        this(orderType, orderRef, origin, destination, plannedStart, plannedEnd, null, null, null, resources,
                source);
    }

    public FeedServiceRequest(String orderType, String orderRef, OffsetDateTime plannedStart,
            OffsetDateTime plannedEnd, Resources resources, JsonNode source) {
        this(orderType, orderRef, null, null, plannedStart, plannedEnd, resources, source);
    }

    /** Truck and trailer by plate, drivers by document; the first driver is the main one. */
    public record Resources(String truck, String trailer, List<String> drivers) {
    }

    public Resources resourcesOrEmpty() {
        return resources == null ? new Resources(null, null, List.of()) : resources;
    }
}
