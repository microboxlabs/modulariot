package com.microboxlabs.miot.integrations.domain;

public enum AuthType {
    NONE,
    BEARER_TOKEN,
    API_KEY_HEADER,
    API_KEY_QUERY,
    BASIC,
    OAUTH2_CLIENT_CREDENTIALS,
    CUSTOM_HEADERS
}
