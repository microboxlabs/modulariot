package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** Feed profiles and the per-service state of each feed. Every call is tenant-scoped. */
public interface FeedStore {

    Optional<FeedProfile> profile(String tenantCode, String feedKey);

    List<FeedProfile> profiles(String tenantCode);

    /** Inserts or replaces the profile (tenant, feedKey). */
    FeedProfile saveProfile(FeedProfile profile);

    /** The service; inside a transaction its row stays locked until the transaction ends. */
    Optional<FeedService> service(String tenantCode, String feedKey, String externalCode);

    /**
     * Inside a transaction: the service row locked until it ends, created empty when the feed never sent it; so two
     * reconciles of one service run one after the other.
     */
    FeedService lockService(String tenantCode, String feedKey, String externalCode);

    /** Inserts or replaces the service row. */
    void saveService(FeedService service);
}
