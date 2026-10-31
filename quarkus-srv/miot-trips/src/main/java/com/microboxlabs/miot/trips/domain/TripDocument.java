package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * A file in a trip's file (multimedia): an image or a PDF with a document type. {@code version} grows each time the
 * file is replaced. {@code reviewStatus} is null when the type needs no review. {@code mimetype} and {@code size} are
 * those of the current version's content.
 */
public record TripDocument(
        String id,
        String tenantCode,
        String tripId,
        String contentId,
        String name,
        String docType,
        int version,
        boolean reviewable,
        String reviewStatus,
        OffsetDateTime reviewedAt,
        String reviewedBy,
        String deliveryId,
        String mimetype,
        long size,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String PENDING = "pending";
    public static final String APPROVED = "approved";
    public static final String REJECTED = "rejected";

    /** One decision on one version: the verdict, its reasons and the reviewer's comment. */
    public record Review(String documentId, int seq, int version, String verdict, List<String> reasons,
            String comment, String reviewedBy, OffsetDateTime decidedAt) {

        public static final Set<String> VERDICTS = Set.of("APPROVED", "REJECTED", "PENDING");
    }
}
