package com.microboxlabs.miot.fleet.network;

import java.util.Set;

/**
 * The organization asking, and the client ids whose signals count as its own: its credential and, for a parent
 * organization, its children's.
 */
public record Viewer(String organizationId, Set<String> clientIds) {

    public Viewer {
        clientIds = Set.copyOf(clientIds);
    }
}
