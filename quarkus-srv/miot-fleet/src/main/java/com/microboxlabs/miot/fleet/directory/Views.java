package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** The shapes the fleet API answers with. */
public final class Views {

    private Views() {
    }

    /** One line of the fleet list. */
    public record AssetRow(String id, String label, AssetKind kind, AssetStatus status, String carrier,
            String driver, TripView currentTrip, TripView nextTrip, DocumentView accreditation, double km30d,
            Instant lastSignalAt, String gpsProvider, int suggestions) {
    }

    /** Counts over every asset the organization sees, before filters. */
    public record Summary(int assets, int withSignal, int inTrip, int plannedToday, int noSignal, int documentsDue,
            int suggestions) {
    }

    public record Facet(String value, int count) {
    }

    public record AssetPage(List<AssetRow> items, int total, int page, int size, Summary summary,
            List<Facet> kinds, List<Facet> carriers) {
    }

    /**
     * One field of an asset. {@code value} is what the fleet uses; {@code integrationValue} is what the integrations
     * say, with {@code reported} as the raw text and {@code count}/{@code total} as trip support.
     */
    public record FieldView(String key, String value, FieldSource source, String integrationValue,
            FieldSource integrationSource, String reported, Integer count, Integer total, boolean conflict,
            boolean editable) {
    }

    public record DocumentView(String key, LocalDate expiresAt, DocumentStatus status) {
    }

    public record SuggestionView(String kind, String field, String value, int count, int total) {
    }

    public record LiveView(Instant lastSignalAt, Double lat, Double lon, Double speed, Boolean engineOn,
            String gpsProvider, String driver) {
    }

    /** Last 30 days. Percentages are null when there is no data to divide. */
    public record Indicators(double km30d, double engineHours30d, Double idlePct, Double utilizationPct,
            Double fleetUtilizationPct, int trips30d, Double avgTripHours) {
    }

    public record AssetDetail(String id, String label, AssetKind kind, AssetStatus status, List<FieldView> fields,
            LiveView live, Indicators indicators, TripView currentTrip, List<TripView> plannedTrips,
            List<TripView> recentTrips, List<DocumentView> documents, List<SuggestionView> suggestions,
            List<Change> changes) {
    }

    /** A partial edit. A null or blank value clears the field, so the integrations fill it again. */
    public record AssetUpdate(Map<String, String> fields, Map<String, String> documents) {
    }
}
