package com.microboxlabs.miot.integrations.domain;

/**
 * What kind of thing references a credential. Shown next to each consumer when a
 * credential is inspected or deleted, so the operator can tell what would break.
 *
 * <p>{@link #DATA_SOURCE} is never produced today: data sources are Alfresco nodes
 * carrying their own encrypted config and do not reference a credential profile yet.
 */
public enum CredentialUsageKind {
    DATA_SOURCE,
    INTEGRATION,
    JOB,
    CHANNEL
}
