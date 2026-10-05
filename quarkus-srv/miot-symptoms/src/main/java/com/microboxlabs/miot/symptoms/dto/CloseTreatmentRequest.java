package com.microboxlabs.miot.symptoms.dto;

/** Body to finish a treatment. Both fields are optional. */
public record CloseTreatmentRequest(String resolution, String note) {
}
