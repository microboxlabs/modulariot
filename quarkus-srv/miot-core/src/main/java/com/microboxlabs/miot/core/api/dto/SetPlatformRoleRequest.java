package com.microboxlabs.miot.core.api.dto;

import java.util.Set;

/** Replaces every database-held assignee of a platform role. */
public record SetPlatformRoleRequest(Set<String> assigneeIds) {
}
