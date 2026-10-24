package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import java.util.List;

/** Where a feed batch puts its jobs: the async-jobs ledger in the modulith. */
public interface FeedJobQueue {

    void queue(String tenantCode, String feedKey, List<AsyncJobSpec> jobs);
}
