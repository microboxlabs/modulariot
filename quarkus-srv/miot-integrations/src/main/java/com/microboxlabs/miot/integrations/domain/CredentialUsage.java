package com.microboxlabs.miot.integrations.domain;

/**
 * One place a credential is referenced from — the payoff of configuring it once.
 *
 * @param id    the referencing entity's id (a connection id today)
 * @param label its display name, shown verbatim to the operator
 */
public record CredentialUsage(
        String id,
        String label,
        CredentialUsageKind kind) {
}
