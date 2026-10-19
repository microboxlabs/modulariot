package com.microboxlabs.miot.fleet.sharing;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** {@link ShareStore} for the demo source and tests. */
public class InMemoryShareStore implements ShareStore {

    private final List<DataShare> shares = new ArrayList<>();

    public InMemoryShareStore(List<DataShare> seed) {
        shares.addAll(seed);
    }

    @Override
    public synchronized List<DataShare> all() {
        return List.copyOf(shares);
    }

    @Override
    public synchronized void create(DataShare share) {
        shares.add(0, share);
    }

    @Override
    public synchronized Optional<DataShare> revoke(UUID id, String by, Instant at) {
        for (int i = 0; i < shares.size(); i++) {
            DataShare share = shares.get(i);
            if (share.id().equals(id) && share.revokedAt() == null) {
                DataShare revoked = share.revoke(by, at);
                shares.set(i, revoked);
                return Optional.of(revoked);
            }
        }
        return Optional.empty();
    }
}
