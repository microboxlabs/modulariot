package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.TripDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The documents of trips, their versions and review rounds. */
public interface TripDocumentStore {

    /** The trip's documents, oldest first. */
    List<TripDocument> list(String tenantCode, UUID tripId);

    /** Inside a transaction the row stays locked until it ends. */
    Optional<TripDocument> find(String tenantCode, UUID tripId, UUID documentId);

    /** Inserts the document and its first version. */
    TripDocument insert(TripDocument document);

    /** Replaces content, name, type, version and review state; a new version also records its content. */
    TripDocument update(TripDocument document, boolean newVersion);

    /** Deletes the document with its versions and reviews; returns the contents of every version. */
    List<UUID> delete(String tenantCode, UUID documentId);

    List<TripDocument.Review> reviews(String tenantCode, UUID documentId);

    TripDocument.Review insert(TripDocument.Review review);
}
