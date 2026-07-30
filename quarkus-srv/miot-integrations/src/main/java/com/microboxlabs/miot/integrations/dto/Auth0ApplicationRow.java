package com.microboxlabs.miot.integrations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A row as the quarkus-auth0 applications endpoint publishes it.
 *
 * <p>Kept separate from {@link Auth0ClientSummary} on purpose: this is another
 * service's wire shape and may gain fields, while the summary is the contract
 * this module hands the browser. {@code @JsonIgnoreProperties} means the
 * upstream can add columns without breaking deserialization here.
 *
 * <p>Both spellings of the identifier are accepted because the endpoint does
 * not exist yet — the service's own entity calls it {@code auth0ClientId}, and
 * a REST layer built on top of it may well publish {@code clientId}. Tolerating
 * either keeps that decision from blocking this side.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Auth0ApplicationRow {

    @JsonProperty("auth0ClientId")
    public String auth0ClientId;

    @JsonProperty("clientId")
    public String clientId;

    public String name;

    public String description;

    /** Null is treated as active — absence should not hide a usable client. */
    public Boolean active;

    /** The identifier under whichever key the service used, or null if neither. */
    public String resolveClientId() {
        if (auth0ClientId != null && !auth0ClientId.isBlank()) {
            return auth0ClientId.trim();
        }
        if (clientId != null && !clientId.isBlank()) {
            return clientId.trim();
        }
        return null;
    }
}
