package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
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

    /** The tester for one connection; a tester may claim it by more than its provider type. */
    public ConnectionTester testerFor(IntegrationConnection connection) {
        for (ConnectionTester tester : testers) {
            if (tester.supports(connection)) {
                return tester;
            }
        }
        return fallback;
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
