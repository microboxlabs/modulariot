package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * The desired state of one external service, as a feed sends it. Resources are named by their natural keys (plate,
 * document); the trips module resolves them in fleet. {@code origin} and {@code destination} are the source's names
 * for the places, matched as sent against the locations' external codes; an unknown one creates the location.
 * {@code actualStart}, {@code actualArrival} and {@code actualEnd} are the departure, arrival and closure a person
 * recorded at the source; each confirms that milestone of the trip. {@code milestones} reports any milestone by name
 * ({@code presentation}, {@code validation}…) with the metadata the source has; see {@link MilestoneReport}.
 * {@code slaMinutes} is the mandate's agreed lead time. {@code cargo} lists the units of the load in order; the
 * n-th item is the mandate's n-th unit. Without cargo the units are left as they are.
 * {@code source} is the original record (a spreadsheet row), kept for audit and not compared.
 * {@code originSite} and {@code destinationSite} say where each place is; a location that is not resolved yet is
 * located from them after the service is applied (see {@link Site}).
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
        JsonNode source,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, MilestoneReport> milestones,
        @JsonInclude(JsonInclude.Include.NON_NULL) Integer slaMinutes,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<CargoItem> cargo,
        @JsonInclude(JsonInclude.Include.NON_NULL) Site originSite,
        @JsonInclude(JsonInclude.Include.NON_NULL) Site destinationSite) {

    public FeedServiceRequest {
        milestones = milestones == null ? Map.of()
                : java.util.Collections.unmodifiableMap(new java.util.TreeMap<>(milestones));
        cargo = cargo == null ? List.of() : List.copyOf(cargo);
    }

    @SuppressWarnings("java:S107") // The feed row without sites.
    public FeedServiceRequest(String orderType, String orderRef, String origin, String destination,
            OffsetDateTime plannedStart, OffsetDateTime plannedEnd, OffsetDateTime actualStart,
            OffsetDateTime actualArrival, OffsetDateTime actualEnd, Resources resources, JsonNode source,
            Map<String, MilestoneReport> milestones, Integer slaMinutes, List<CargoItem> cargo) {
        this(orderType, orderRef, origin, destination, plannedStart, plannedEnd, actualStart, actualArrival,
                actualEnd, resources, source, milestones, slaMinutes, cargo, null, null);
    }

    /**
     * Where a place is, as the source declares it: the address with its district and country, a Plus Code, or
     * coordinates. {@code districtCode} is the Peruvian ubigeo or the Chilean commune code; {@code country} is ISO
     * 3166 alpha-2.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Site(String address, String country, String districtCode, String district, String plusCode,
            Double latitude, Double longitude) {
    }

    @SuppressWarnings("java:S107") // The feed row without SLA or cargo.
    public FeedServiceRequest(String orderType, String orderRef, String origin, String destination,
            OffsetDateTime plannedStart, OffsetDateTime plannedEnd, OffsetDateTime actualStart,
            OffsetDateTime actualArrival, OffsetDateTime actualEnd, Resources resources, JsonNode source,
            Map<String, MilestoneReport> milestones) {
        this(orderType, orderRef, origin, destination, plannedStart, plannedEnd, actualStart, actualArrival,
                actualEnd, resources, source, milestones, null, null);
    }

    /** One unit of the load: what it is, how many, its weight in kg and its volume in m³. */
    public record CargoItem(String description, BigDecimal qty, String qtyUnit, BigDecimal weightKg,
            BigDecimal volumeM3) {
    }

    @SuppressWarnings("java:S107") // The feed row without milestone reports.
    public FeedServiceRequest(String orderType, String orderRef, String origin, String destination,
            OffsetDateTime plannedStart, OffsetDateTime plannedEnd, OffsetDateTime actualStart,
            OffsetDateTime actualArrival, OffsetDateTime actualEnd, Resources resources, JsonNode source) {
        this(orderType, orderRef, origin, destination, plannedStart, plannedEnd, actualStart, actualArrival,
                actualEnd, resources, source, null);
    }

    public FeedServiceRequest(String orderType, String orderRef, String origin, String destination,
            OffsetDateTime plannedStart, OffsetDateTime plannedEnd, Resources resources, JsonNode source) {
        this(orderType, orderRef, origin, destination, plannedStart, plannedEnd, null, null, null, resources,
                source);
    }

    public FeedServiceRequest(String orderType, String orderRef, OffsetDateTime plannedStart,
            OffsetDateTime plannedEnd, Resources resources, JsonNode source) {
        this(orderType, orderRef, null, null, plannedStart, plannedEnd, resources, source);
    }

    /**
     * One milestone as the source knows it. With {@code at} it confirms the milestone at that time; without it the
     * milestone waits for a confirmation. {@code evidence} is kept with the milestone; empty ones are left out.
     */
    public record MilestoneReport(OffsetDateTime at, Map<String, Object> evidence) {
    }

    /**
     * Truck and trailer by plate, drivers by document; the first driver is the main one. {@code carrier} and
     * {@code driverDetails} are what a feed that registers resources needs to add the ones fleet does not have: the
     * vehicles' carrier, and each driver's name and mobile phone by document.
     */
    public record Resources(String truck, String trailer, List<String> drivers, Carrier carrier,
            List<Person> driverDetails) {

        public Resources(String truck, String trailer, List<String> drivers) {
            this(truck, trailer, drivers, null, null);
        }

        /** The details sent for {@code document}, compared ignoring dots, dashes, spaces and case. */
        public Person detailsOf(String document) {
            String key = key(document);
            return driverDetails == null || key.isEmpty() ? null : driverDetails.stream()
                    .filter(p -> p != null && key.equals(key(p.document()))).findFirst().orElse(null);
        }

        /** The canonical plate/document key used by fleet lookups. */
        public static String key(String value) {
            return value == null ? "" : value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(java.util.Locale.ROOT);
        }
    }

    /** A carrier by its tax id (RUT, RUC) and legal name. */
    public record Carrier(String taxId, String name) {
    }

    /** A driver's document, full name and mobile phone. */
    public record Person(String document, String name, String phone) {
    }

    public Resources resourcesOrEmpty() {
        return resources == null ? new Resources(null, null, List.of()) : resources;
    }
}
