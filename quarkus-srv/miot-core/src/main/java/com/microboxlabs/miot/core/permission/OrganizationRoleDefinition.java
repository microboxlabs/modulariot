package com.microboxlabs.miot.core.permission;

import jakarta.ws.rs.BadRequestException;

/** Roles governed by the application rather than projected to Alfresco. */
public enum OrganizationRoleDefinition {
    OWNER("ORGANIZATION_OWNER");

    private final String roleCode;

    OrganizationRoleDefinition(String roleCode) {
        this.roleCode = roleCode;
    }

    public String roleCode() {
        return roleCode;
    }

    public static OrganizationRoleDefinition fromCode(String roleCode) {
        for (OrganizationRoleDefinition definition : values()) {
            if (definition.roleCode.equals(roleCode)) {
                return definition;
            }
        }
        throw new BadRequestException("Unknown organization role: " + roleCode);
    }
}
