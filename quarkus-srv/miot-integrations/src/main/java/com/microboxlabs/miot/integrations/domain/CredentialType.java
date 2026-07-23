package com.microboxlabs.miot.integrations.domain;

/**
 * What the operator picked in the credentials screen — the shape of the form they
 * filled in, which is finer-grained than {@link AuthType}: Azure Entra and a generic
 * OAuth2 provider both resolve as {@link AuthType#OAUTH2_CLIENT_CREDENTIALS} but ask
 * for different fields (a directory id and a derived token endpoint vs. a bare token
 * URL). Storing only the auth type would lose that choice on the way back out.
 *
 * <p>Ids match the frontend's {@code CredentialTypeId} exactly, so no translation
 * layer sits between the picker and this enum. Which types the picker actually offers
 * is the frontend catalog's business — the backend accepts any type whose config it
 * can validate.
 */
public enum CredentialType {

    AZURE_ENTRA_CLIENT_CREDENTIALS(AuthType.OAUTH2_CLIENT_CREDENTIALS),
    OAUTH2_CLIENT_CREDENTIALS(AuthType.OAUTH2_CLIENT_CREDENTIALS),
    API_KEY(AuthType.API_KEY_HEADER),
    BEARER_TOKEN(AuthType.BEARER_TOKEN),
    BASIC_AUTH(AuthType.BASIC);

    private final AuthType defaultAuthType;

    CredentialType(AuthType defaultAuthType) {
        this.defaultAuthType = defaultAuthType;
    }

    /**
     * The auth type to store when the caller did not state one. Only a default: an
     * explicit {@code authType} on the request wins, because the mapping is lossy in
     * this direction — {@link #API_KEY} covers both header and query placement and
     * would otherwise silently move a query-string key into a header.
     */
    public AuthType defaultAuthType() {
        return defaultAuthType;
    }

    /**
     * Best-effort type for a profile that predates the column, or for a caller that
     * still sends only an {@code authType} (the WhatsApp channel does). Never returns
     * {@link #AZURE_ENTRA_CLIENT_CREDENTIALS}: the directory id that would make it
     * Entra was never captured, so claiming it would be a guess.
     */
    public static CredentialType fromAuthType(AuthType authType) {
        if (authType == null) {
            return BEARER_TOKEN;
        }
        return switch (authType) {
            case OAUTH2_CLIENT_CREDENTIALS -> OAUTH2_CLIENT_CREDENTIALS;
            case BASIC -> BASIC_AUTH;
            case API_KEY_HEADER, API_KEY_QUERY -> API_KEY;
            default -> BEARER_TOKEN;
        };
    }
}
