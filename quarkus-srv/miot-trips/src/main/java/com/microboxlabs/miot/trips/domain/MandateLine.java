package com.microboxlabs.miot.trips.domain;

/** A line of the mandate; v1 keeps exactly one per mandate, auto-created by trigger. */
public record MandateLine(String id, String tenantCode, String mandateId, int seq, String itemId) {
}
