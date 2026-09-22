package com.microboxlabs.miot.symptoms.dto;

/**
 * Body to finish a treatment. {@code messageToDriver} and {@code driverResponse}
 * are what the legacy tower stores on the mirrored row; when absent they are
 * derived from the episode's actions.
 */
public record CloseTreatmentRequest(
        String resolution,
        String note,
        String messageToDriver,
        String driverResponse) {
}
