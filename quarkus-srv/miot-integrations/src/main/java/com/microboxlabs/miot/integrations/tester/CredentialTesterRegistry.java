package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Map;

/**
 * Routes a credential to the {@link CredentialTester} that handles its type. Unlike
 * {@link ConnectionTesterRegistry} there is no generic fallback: a type nobody can
 * exercise reports that plainly instead of passing a check it never ran.
 */
@ApplicationScoped
public class CredentialTesterRegistry {

    private final Instance<CredentialTester> testers;

    @Inject
    public CredentialTesterRegistry(Instance<CredentialTester> testers) {
        this.testers = testers;
    }

    public boolean isTestable(CredentialType type) {
        return find(type) != null;
    }

    public CredentialTestResponse test(
            CredentialType type,
            Map<String, Object> publicConfig,
            Map<String, Object> secretConfig) {
        CredentialTester tester = find(type);
        if (tester == null) {
            return CredentialTestResponse.failure(
                    "Credentials of type " + type + " cannot be verified on their own");
        }
        return tester.test(type, publicConfig, secretConfig);
    }

    private CredentialTester find(CredentialType type) {
        for (CredentialTester tester : testers) {
            if (tester.supports(type)) {
                return tester;
            }
        }
        return null;
    }
}
