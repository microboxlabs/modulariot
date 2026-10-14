package com.microboxlabs.miot.fleet.network;

/** Why an organization sees an asset. */
public enum AccessReason {
    /** One of its credentials sends the asset's signals. */
    REPORTER,
    /** It owns the asset. */
    OWNER,
    /** It operates the asset in a trip or under an accreditation. */
    OPERATOR,
    /** The asset travels with one it operates, such as a trailer or a decoy in the cargo. */
    LINKED
}
