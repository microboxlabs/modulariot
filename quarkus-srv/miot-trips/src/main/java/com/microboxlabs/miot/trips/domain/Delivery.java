package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Loads of a trip handed to one customer together: the trip's mandates it covers, its steps and its proofs (POD).
 * {@code reference} is the delivery's code in the source system; a trip has one delivery per reference.
 */
public record Delivery(
        String id,
        String tenantCode,
        String tripId,
        String reference,
        String customer,
        String source,
        Map<String, Object> evidence,
        String note,
        List<String> mandateIds,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public Delivery {
        evidence = evidence == null ? Map.of() : Map.copyOf(evidence);
        mandateIds = mandateIds == null ? List.of() : List.copyOf(mandateIds);
    }

    /** A step of the delivery: {@code delivered}, {@code accepted} or {@code settled}, like a trip milestone. */
    public record Step(
            String deliveryId,
            String step,
            String tenantCode,
            String status,
            String source,
            OffsetDateTime proposedAt,
            Map<String, Object> evidence,
            OffsetDateTime confirmedAt,
            String confirmedBy,
            String channel,
            String note,
            OffsetDateTime updatedAt,
            String updatedBy) {

        public Step {
            evidence = evidence == null ? Map.of() : Map.copyOf(evidence);
        }

        public static Step unrecorded(String tenantCode, String deliveryId, String step) {
            return new Step(deliveryId, step, tenantCode, TripMilestone.OPEN, null, null, Map.of(), null, null, null,
                    null, null, null);
        }

        public boolean isConfirmed() {
            return TripMilestone.CONFIRMED.equals(status);
        }

        public boolean isPending() {
            return TripMilestone.PENDING.equals(status);
        }
    }

    /**
     * A proof of the delivery: a file in the content store ({@code contentId}) or a link to one kept elsewhere
     * ({@code url}). {@code kind} is {@code signature}, {@code photo}, {@code document} or {@code other}.
     */
    public record Proof(
            String id,
            String deliveryId,
            String tenantCode,
            String kind,
            String contentId,
            String url,
            String name,
            String mimetype,
            Map<String, Object> metadata,
            String source,
            OffsetDateTime receivedAt,
            String receivedBy) {

        public static final List<String> KINDS = List.of("signature", "photo", "document", "other");

        public Proof {
            metadata = metadata == null ? Map.of() : Map.copyOf(metadata);
        }
    }
}
