package com.microboxlabs.miot.trips.dto;

import java.util.List;

/**
 * What a batch did: the services whose state changed, each queued as one async job ({@code trips_feed_service},
 * correlation key = external code), the unchanged ones, and the items refused before queueing (zero-based item index, code and reason).
 */
public record FeedBatchResult(
        String batchId,
        int received,
        List<String> queued,
        List<String> unchanged,
        List<Refusal> refused) {

    public record Refusal(int index, String externalCode, String reason) {
    }
}
