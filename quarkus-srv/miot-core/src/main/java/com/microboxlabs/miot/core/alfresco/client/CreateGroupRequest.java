package com.microboxlabs.miot.core.alfresco.client;

/**
 * Request body for {@code POST /groups} — Alfresco REST.
 * {@code id} is the authority id (e.g. {@code "GROUP_TRAZA"}) and
 * {@code displayName} is the human label.
 */
public record CreateGroupRequest(String id, String displayName) {
}
