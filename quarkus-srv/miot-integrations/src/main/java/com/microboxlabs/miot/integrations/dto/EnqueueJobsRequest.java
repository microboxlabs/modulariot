package com.microboxlabs.miot.integrations.dto;

import java.util.List;

public record EnqueueJobsRequest(
        String sourceInstance,
        String enqueuedBy,
        List<AsyncJobSpec> jobs) {
}
