package com.microboxlabs.miot.fleet.network;

import java.time.Instant;

/**
 * One observation relating a party to an asset. {@code counterparty} is the carrier an {@link EvidenceKind#OPERATES}
 * observation names. {@code validUntil} is set when the source gives an end (an accreditation, a closed trip link);
 * otherwise the evidence expires a configured time after {@code lastSeen}.
 */
public record Evidence(
        EvidenceKind kind,
        String party,
        String assetId,
        String counterparty,
        EvidenceSource source,
        String reference,
        Instant firstSeen,
        Instant lastSeen,
        Instant validUntil) {
}
