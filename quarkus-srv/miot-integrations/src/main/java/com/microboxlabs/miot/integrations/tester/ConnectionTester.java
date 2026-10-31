package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;

/**
 * Provider-specific connectivity check for an integration connection. Implementations
 * declare which {@link ProviderType}s they handle; the {@link ConnectionTesterRegistry}
 * routes a connection to the right one (falling back to a generic contract check).
 */
public interface ConnectionTester {

    boolean supports(ProviderType providerType);

    /** Whether this tester handles the connection; by default, decided by its provider type. */
    default boolean supports(IntegrationConnection connection) {
        return supports(connection.providerType());
    }

    /**
     * @param credential the connection's linked credential profile, or {@code null} if none is set
     */
    ConnectionTestResponse test(
            IntegrationConnection connection,
            CredentialProfile credential,
            ConnectionTestRequest request);

    /** Whether {@link #test} calls the provider with the credential, so its result also holds for the credential. */
    default boolean validatesCredential() {
        return true;
    }
}
