package com.microboxlabs.miot.trips.dto;

import java.util.List;

/**
 * Every service a feed currently lists (a spreadsheet read, a TMS export). {@code batchId} is optional: the feed's
 * own id for the send, shown on the jobs; one is generated when missing.
 */
public record FeedBatchRequest(String batchId, List<Item> services) {

    public record Item(String externalCode, FeedServiceRequest desired) {
    }
}
