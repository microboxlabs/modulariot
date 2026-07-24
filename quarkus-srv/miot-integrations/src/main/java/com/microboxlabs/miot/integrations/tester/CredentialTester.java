package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import java.util.Map;

/**
 * Verifies a credential on its own, with no connection and no business endpoint
 * involved. Distinct from {@link ConnectionTester}, which probes a specific provider's
 * API: a client-credentials grant can be exercised by asking for a token and throwing it
 * away, which is a complete answer to "is this secret still good?".
 *
 * <p>Not every type has such an answer. A bare API key or bearer token means nothing
 * until some endpoint is chosen, so no tester claims those and the registry reports them
 * as untestable rather than inventing a pass.
 */
public interface CredentialTester {

    boolean supports(CredentialType type);

    /**
     * @param secretConfig the decrypted secret half — never logged, never echoed back
     */
    CredentialTestResponse test(
            CredentialType type,
            Map<String, Object> publicConfig,
            Map<String, Object> secretConfig);
}
