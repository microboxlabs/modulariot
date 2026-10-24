package com.microboxlabs.miot.trips.dto;

/** Links a mandate to a trip — the convergence. */
public record LinkMandateRequest(String mandateId, Integer seq, String role) {
}
