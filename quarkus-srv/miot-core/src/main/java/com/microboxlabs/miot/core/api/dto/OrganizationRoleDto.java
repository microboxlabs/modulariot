package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/** Application-owned role assignments within an organization. */
public record OrganizationRoleDto(String roleCode, List<String> assigneeIds) {
}
