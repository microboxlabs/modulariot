package com.microboxlabs.miot.fleet.sharing;

import java.util.Set;

/**
 * An organization as the sharing screens show it. The roles are read from the GPS data, not declared: {@code SENDER}
 * when its client sends signals, {@code OPERATOR} when it creates trips.
 */
public record SharingOrg(String slug, String name, String clientId, Set<Role> roles, int assetCount) {

    public enum Role {
        SENDER, OPERATOR
    }

    /** An organization as the modulith stores it. */
    public record Ref(String slug, String name, String clientId) {
    }
}
