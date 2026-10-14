package com.microboxlabs.miot.fleet.network;

import java.util.List;

/** Everything a source knows: organizations, assets and the evidence relating them. */
public record NetworkSnapshot(List<NetworkOrganization> organizations, List<Asset> assets, List<Evidence> evidence) {

    public NetworkSnapshot {
        organizations = List.copyOf(organizations);
        assets = List.copyOf(assets);
        evidence = List.copyOf(evidence);
    }
}
