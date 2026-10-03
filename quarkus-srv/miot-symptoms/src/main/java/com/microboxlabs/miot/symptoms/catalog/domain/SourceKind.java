package com.microboxlabs.miot.symptoms.catalog.domain;

/**
 * SIGNAL: each GPS pulse. EVENT: a device or app event. CHECK: a scheduled job.
 * TRIP_EVENT: a TMS change. WEBHOOK: an inbound Integrations connection.
 */
public enum SourceKind {
    SIGNAL,
    EVENT,
    CHECK,
    TRIP_EVENT,
    WEBHOOK
}
