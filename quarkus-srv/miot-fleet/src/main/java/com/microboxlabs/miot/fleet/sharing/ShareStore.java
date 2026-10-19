package com.microboxlabs.miot.fleet.sharing;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Where the shares are kept. Shares are never deleted: revoking one stamps it. */
public interface ShareStore {

    List<DataShare> all();

    /**
     * Saves the share, unless another share already covers it ({@link DataShare#alreadyCovers}). The check and the
     * insert are one step, so two requests for the same pair cannot both succeed.
     *
     * @throws AlreadyCovered when a share in force already gives the target all of the source's assets
     */
    void create(DataShare share);

    /** The revoked share, or empty when there is none with that id or it was already revoked. */
    Optional<DataShare> revoke(UUID id, String by, Instant at);

    class AlreadyCovered extends RuntimeException {

        public AlreadyCovered() {
            super("Another share already covers this organization pair");
        }
    }
}
