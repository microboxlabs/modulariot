package com.microboxlabs.miot.integrations.dto;

/**
 * Grants one principal access to a thread. {@code permission} accepts only
 * "read" today; the column carries a CHECK so a wider grant needs a migration
 * and a deliberate decision about who may append to a conversation.
 */
public record ThreadShareRequest(
        String principal,
        String permission) {
}
