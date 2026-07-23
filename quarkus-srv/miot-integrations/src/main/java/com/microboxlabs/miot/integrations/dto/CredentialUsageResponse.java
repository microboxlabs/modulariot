package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.CredentialUsageKind;

/** One consumer of a credential, as returned alongside the credential itself. */
public record CredentialUsageResponse(
        String id,
        String label,
        CredentialUsageKind kind) {
}
