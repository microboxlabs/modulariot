package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.dto.CredentialUsageResponse;
import java.util.List;

/**
 * Deleting a credential something still references would break that thing silently, at
 * whatever hour it next runs. Carries the consumers so the operator is told what would
 * break rather than just being refused.
 */
public class CredentialInUseException extends RuntimeException {

    private final transient List<CredentialUsageResponse> usages;

    public CredentialInUseException(List<CredentialUsageResponse> usages) {
        super("The credential is still referenced by " + usages.size() + " item(s)");
        this.usages = List.copyOf(usages);
    }

    public List<CredentialUsageResponse> usages() {
        return usages;
    }
}
