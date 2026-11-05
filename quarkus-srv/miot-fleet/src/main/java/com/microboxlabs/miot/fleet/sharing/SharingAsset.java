package com.microboxlabs.miot.fleet.sharing;

import java.time.Instant;

/**
 * An asset an organization can share: its last signal came from one of the organization's clients. {@code kind}
 * and {@code owner} are the signal's free-text {@code type} and {@code owner}, empty when the sender leaves them out.
 */
public record SharingAsset(String id, String kind, String owner, Instant lastSeen) {

    public SharingAsset {
        kind = kind == null ? "" : kind.trim();
        owner = owner == null ? "" : owner.trim();
    }
}
