package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import java.util.List;
import java.util.function.BooleanSupplier;

/** Where a feed batch puts its jobs: the async-jobs ledger in the modulith. */
public interface FeedJobQueue {

    void queue(String tenantCode, String feedKey, List<AsyncJobSpec> jobs);
    /** Accepts and queues one service; durable implementations commit both writes together. */
    default boolean acceptAndQueue(String tenantCode, String feedKey, AsyncJobSpec job, BooleanSupplier accept) {
        if (!accept.getAsBoolean()) {
            return false;
        }
        queue(tenantCode, feedKey, List.of(job));
        return true;
    }
}
