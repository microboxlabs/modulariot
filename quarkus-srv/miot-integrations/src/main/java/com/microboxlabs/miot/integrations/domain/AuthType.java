package com.microboxlabs.miot.integrations.domain;

public enum AuthType {
    NONE,
    BEARER_TOKEN,
    API_KEY_HEADER,
    API_KEY_QUERY,
    BASIC,
    OAUTH2_CLIENT_CREDENTIALS,
    /** A Google service account, exchanged for an access token with a signed JWT. */
    GOOGLE_SERVICE_ACCOUNT,
    CUSTOM_HEADERS
}
