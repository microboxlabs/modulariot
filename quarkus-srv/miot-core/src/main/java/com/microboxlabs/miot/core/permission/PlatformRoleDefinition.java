package com.microboxlabs.miot.core.permission;

import jakarta.ws.rs.BadRequestException;

/** Roles that span every organization rather than sitting inside one. */
public enum PlatformRoleDefinition {
    OWNER("PLATFORM_OWNER");

    private final String roleCode;

    PlatformRoleDefinition(String roleCode) {
        this.roleCode = roleCode;
    }

    public String roleCode() {
        return roleCode;
    }

    public static PlatformRoleDefinition fromCode(String roleCode) {
        for (PlatformRoleDefinition definition : values()) {
            if (definition.roleCode.equals(roleCode)) {
                return definition;
            }
        }
        throw new BadRequestException("Unknown platform role: " + roleCode);
    }
}
