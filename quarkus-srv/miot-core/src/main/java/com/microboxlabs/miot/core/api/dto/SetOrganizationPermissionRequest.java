package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/** Full replacement request for an application-owned organization permission. */
public record SetOrganizationPermissionRequest(boolean enabled, List<String> assigneeIds) {
}
