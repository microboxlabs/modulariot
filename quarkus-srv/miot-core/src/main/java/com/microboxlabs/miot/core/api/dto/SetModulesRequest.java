package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/**
 * Request body for {@code PUT /api/v1/orgs/{slug}/modules}.
 *
 * <p>The server treats this as a full replacement — module codes in
 * the list become enabled, everything else is disabled. An empty
 * list disables every module for the org.
 */
public record SetModulesRequest(List<String> modules) {
}
