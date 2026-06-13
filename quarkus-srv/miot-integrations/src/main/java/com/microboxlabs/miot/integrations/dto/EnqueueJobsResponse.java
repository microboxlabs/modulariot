package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import java.util.List;

public record EnqueueJobsResponse(
        List<AsyncJob> created,
        int duplicates) {
}
