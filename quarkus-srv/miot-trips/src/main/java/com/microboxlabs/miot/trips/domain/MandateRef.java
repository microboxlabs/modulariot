package com.microboxlabs.miot.trips.domain;

/** A mandate as seen from a trip: the contractual link plus the code people know it by. */
public record MandateRef(String mandateId, String externalCode, String status, int seq, String role) {
}
