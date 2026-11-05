package com.microboxlabs.miot.fleet.directory;

/** Filters and page of the fleet list. Null filters match everything. */
public record AssetQuery(String q, AssetKind kind, AssetStatus status, String carrier, boolean withSuggestions,
        boolean documentsDue, String sort, int page, int size) {

    public static final int MAX_SIZE = 200;

    public AssetQuery {
        page = Math.max(page, 0);
        size = size <= 0 ? 50 : Math.min(size, MAX_SIZE);
    }
}
