package com.microboxlabs.miot.integrations.events;

import com.microboxlabs.miot.integrations.domain.AsyncJob;

/**
 * Fired (synchronously, via CDI) the moment {@link
 * com.microboxlabs.miot.integrations.service.AsyncJobService#report} parks a
 * job as FAILED — attempts exhausted or a non-retryable failure. This is the
 * single funnel both executor lanes report through (ECM via REST, the modulith
 * worker in-process), so observers see every park exactly once, after the
 * ledger write is durable.
 *
 * <p>{@code job} is the parked row (state FAILED, {@code lastError} set).
 * Observers must never throw into the report path — the firer guards, but
 * observers are expected to catch their own failures too.
 */
public record JobParkedEvent(AsyncJob job) {
}
