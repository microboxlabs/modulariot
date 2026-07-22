package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/** Application-owned organization permission configuration and its role assignees. */
public record OrganizationPermissionDto(
        boolean enabled,
        String permissionCode,
        String roleCode,
        List<String> assigneeIds) {
}
