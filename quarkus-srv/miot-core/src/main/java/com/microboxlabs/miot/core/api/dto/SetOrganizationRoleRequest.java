package com.microboxlabs.miot.core.api.dto;

import java.util.Set;

/** Replaces all assignees for an application-owned organization role. */
public record SetOrganizationRoleRequest(Set<String> assigneeIds) {
}
