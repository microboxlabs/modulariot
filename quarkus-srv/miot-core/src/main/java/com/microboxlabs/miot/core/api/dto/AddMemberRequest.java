package com.microboxlabs.miot.core.api.dto;

/**
 * Request body for {@code POST /api/v1/orgs/{slug}/members}.
 * {@code personId} is the Alfresco person id (in this deployment,
 * the user's email address).
 */
public record AddMemberRequest(String personId) {
}
