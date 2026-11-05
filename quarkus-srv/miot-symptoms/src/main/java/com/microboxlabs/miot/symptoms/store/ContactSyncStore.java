package com.microboxlabs.miot.symptoms.store;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/** How far each tenant's contact book is synced from a source. */
public interface ContactSyncStore {

    Optional<OffsetDateTime> syncedUntil(String tenantCode, String source);

    void save(String tenantCode, String source, OffsetDateTime syncedUntil);

    /** The tenants synced from {@code source} at least once. */
    List<String> tenants(String source);

    /** Runs {@code work} unless another replica holds the lock {@code name}; empty when it does. */
    <T> Optional<T> exclusively(String name, Supplier<T> work);
}
