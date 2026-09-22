package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.TreatmentType;

/**
 * Keeps StreamHub {@code public.treatments} in step with the episodes this
 * module owns. The symptom engine reads that table to decide "under
 * treatment", and the older tower views list it, so every episode still lands
 * there through the same SQL function the previous UI called.
 */
public interface LegacyTreatmentMirror {

    /** What the legacy row needs. {@code legacyTreatmentId} null inserts, otherwise updates that row. */
    record Write(
            Long legacyTreatmentId,
            String symptomsClientId,
            long symptomId,
            String assetId,
            String tripId,
            TreatmentType type,
            String assignedTo,
            String message,
            String driverResponse) {
    }

    /** Thrown when StreamHub refuses or cannot be reached; the resource maps it to 502. */
    class MirrorException extends RuntimeException {
        public MirrorException(String message, Throwable cause) {
            super(message, cause);
        }

        public MirrorException(String message) {
            super(message);
        }
    }

    /** Inserts or updates the legacy row and returns its id. */
    long upsert(Write write);
}
