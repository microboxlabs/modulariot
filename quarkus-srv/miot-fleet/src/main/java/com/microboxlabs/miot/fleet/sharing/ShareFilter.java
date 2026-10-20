package com.microboxlabs.miot.fleet.sharing;

import java.util.List;

/** Values of the signal's {@code owner} and {@code type}. An empty list matches any value; the two combine with AND. */
public record ShareFilter(List<String> owners, List<String> kinds) {

    public static final ShareFilter NONE = new ShareFilter(List.of(), List.of());

    public ShareFilter {
        owners = owners == null ? List.of() : List.copyOf(owners);
        kinds = kinds == null ? List.of() : List.copyOf(kinds);
    }

    public boolean matches(SharingAsset asset) {
        return (owners.isEmpty() || owners.contains(asset.owner()))
                && (kinds.isEmpty() || kinds.contains(asset.kind()));
    }

    public boolean isEmpty() {
        return owners.isEmpty() && kinds.isEmpty();
    }
}
