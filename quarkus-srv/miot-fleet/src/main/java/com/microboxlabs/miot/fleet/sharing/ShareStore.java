package com.microboxlabs.miot.fleet.sharing;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Where the shares are kept. Shares are never deleted: revoking one stamps it. */
public interface ShareStore {

    List<DataShare> all();

    void create(DataShare share);

    /** The revoked share, or empty when there is none with that id or it was already revoked. */
    Optional<DataShare> revoke(UUID id, String by, Instant at);
}
