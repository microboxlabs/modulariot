package com.microboxlabs.miot.trips.dto;

import java.util.List;
import java.util.Map;

/**
 * What a batch did: the services whose state changed, each queued as one async job ({@code trips_feed_service},
 * correlation key = external code), the unchanged ones, and the items refused before queueing (code → reason).
 */
public record FeedBatchResult(
        String batchId,
        int received,
        List<String> queued,
        List<String> unchanged,
        Map<String, String> refused) {
}
