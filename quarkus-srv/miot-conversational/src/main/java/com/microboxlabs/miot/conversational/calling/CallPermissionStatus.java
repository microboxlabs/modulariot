package com.microboxlabs.miot.conversational.calling;

/** What a contact last answered to a business number's call permission request. */
public enum CallPermissionStatus {
    /** Never answered. */
    NONE,
    /** Accepted for 7 days; see the permission's expiry. */
    TEMPORARY,
    /** Accepted with no expiry, until the contact revokes it. */
    PERMANENT,
    /** Rejected a request without having granted one before. */
    DECLINED,
    /** Rejected after granting, or Meta revoked it after consecutive unanswered calls. */
    REVOKED
}
