package com.microboxlabs.miot.fleet.network;

import java.util.Set;

/** An organization and the credentials (client ids) it sends signals with. */
public record NetworkOrganization(String id, String name, Set<OrgRole> roles, Set<String> clientIds) {

    public NetworkOrganization {
        roles = Set.copyOf(roles);
        clientIds = Set.copyOf(clientIds);
    }
}
