package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

/**
 * Routes a connection to the {@link ConnectionTester} that handles its provider type,
 * falling back to {@link GenericConnectionTester} (contract-only check) when no live
 * probe is registered.
 */
@ApplicationScoped
public class ConnectionTesterRegistry {

    private final Instance<ConnectionTester> testers;
    private final GenericConnectionTester fallback;

    @Inject
    public ConnectionTesterRegistry(Instance<ConnectionTester> testers, GenericConnectionTester fallback) {
        this.testers = testers;
        this.fallback = fallback;
    }

    public ConnectionTester testerFor(ProviderType providerType) {
        for (ConnectionTester tester : testers) {
            if (tester.supports(providerType)) {
                return tester;
            }
        }
        return fallback;
    }
}
