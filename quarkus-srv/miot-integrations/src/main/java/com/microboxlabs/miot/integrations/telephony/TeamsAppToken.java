package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import java.util.Map;
import java.util.Optional;

/**
 * Gets a Microsoft Graph app token for a TEAMS_PHONE connection from its Entra credential
 * (client credentials grant; scope {@code https://graph.microsoft.com/.default}).
 */
public final class TeamsAppToken {

    public static final String GRAPH_SCOPE = "https://graph.microsoft.com/.default";

    private TeamsAppToken() {
    }

    /** Why the credential cannot get a Graph token, or empty when its shape is right. */
    public static Optional<String> problem(CredentialType type, Map<String, Object> publicConfig) {
        if (type != CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS) {
            return Optional.of("The credential must be a Microsoft Entra app (client credentials)");
        }
        Object scope = publicConfig == null ? null : publicConfig.get("scope");
        if (scope == null || !GRAPH_SCOPE.equals(scope.toString().trim())) {
            return Optional.of("The credential's scope must be " + GRAPH_SCOPE);
        }
        return Optional.empty();
    }

    /**
     * The request headers that carry the token.
     *
     * @throws AuthResolutionException when Entra refuses the client id or secret
     */
    public static Map<String, String> headers(CredentialAuthRegistry registry, CredentialAuthContext context) {
        return registry.resolve(context).headers();
    }
}
