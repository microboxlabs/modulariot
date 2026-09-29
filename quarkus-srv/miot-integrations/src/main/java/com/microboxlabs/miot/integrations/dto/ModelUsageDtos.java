package com.microboxlabs.miot.integrations.dto;

import java.math.BigDecimal;
import java.util.List;

/** Request and response shapes for model token usage. */
public final class ModelUsageDtos {

    private ModelUsageDtos() {
    }

    /** Tokens one model used in a run. {@code inputTokens} excludes cached input. */
    public record UsageLine(
            String provider,
            String model,
            int calls,
            long inputTokens,
            long outputTokens,
            long cacheReadTokens,
            long cacheWriteTokens) {
    }

    /** What the harness reports when a run ends. */
    public record RecordUsageRequest(
            String runId,
            String organization,
            String tenantId,
            String userId,
            List<UsageLine> usage) {
    }

    /** Usage summed per organization and model over a period. */
    public record UsageTotal(
            String organization,
            String provider,
            String model,
            long runs,
            long calls,
            long inputTokens,
            long outputTokens,
            long cacheReadTokens,
            long cacheWriteTokens,
            BigDecimal costUsd,
            long unpricedRuns) {
    }
}
