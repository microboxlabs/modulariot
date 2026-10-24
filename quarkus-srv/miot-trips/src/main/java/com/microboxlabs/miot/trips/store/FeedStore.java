package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
import java.util.List;
import java.util.Optional;

/** Feed profiles and the per-service state of each feed. Every call but {@link #openServices} is tenant-scoped. */
public interface FeedStore {

    Optional<FeedProfile> profile(String tenantCode, String feedKey);

    List<FeedProfile> profiles(String tenantCode);

    /** Inserts or replaces the profile (tenant, feedKey). */
    FeedProfile saveProfile(FeedProfile profile);

    /** The service; inside a transaction its row stays locked until the transaction ends. */
    Optional<FeedService> service(String tenantCode, String feedKey, String externalCode);

    /** Inserts or replaces the service row. */
    void saveService(FeedService service);

    /** Open services of active profiles, least recently reconciled first, across tenants: the clock's work list. */
    List<FeedService> openServices(int limit);
}
