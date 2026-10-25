package com.microboxlabs.miot.trips.domain;

/** One entry of a tenant's selector: a trip created without a monitor gets the first whose condition holds. */
public record MonitorSelector(int seq, String condition, String monitorKey) {
}
