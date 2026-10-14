package com.microboxlabs.miot.fleet.network;

import java.time.Clock;
import java.util.List;
import java.util.NoSuchElementException;

/** Reads the network from the configured source and resolves it for the viewer. */
public class FleetNetworkService {

    private final NetworkSource source;
    private final NetworkPolicy policy;
    private final Clock clock;

    public FleetNetworkService(NetworkSource source, NetworkPolicy policy, Clock clock) {
        this.source = source;
        this.policy = policy;
        this.clock = clock;
    }

    public List<AssetView> assets(Viewer viewer) {
        return resolver(viewer).assets(viewer.organizationId());
    }

    public AssetView asset(Viewer viewer, String assetId) {
        return resolver(viewer).asset(viewer.organizationId(), assetId)
                .orElseThrow(() -> new NoSuchElementException("Asset not found: " + assetId));
    }

    public List<RelationshipView> relationships(Viewer viewer) {
        return resolver(viewer).relationships(viewer.organizationId());
    }

    private NetworkResolver resolver(Viewer viewer) {
        return new NetworkResolver(source.load(viewer), policy, clock.instant());
    }
}
