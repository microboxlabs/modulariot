package com.microboxlabs.miot.core.permission;

import jakarta.ws.rs.NotFoundException;
import java.util.Arrays;

/** Supported application permissions and the application role that grants each one. */
public enum OrganizationPermissionDefinition {

    CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE(
            "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE",
            "CONTENT_REVIEW_AUTO_APPROVER");

    private final String permissionCode;
    private final String roleCode;

    OrganizationPermissionDefinition(String permissionCode, String roleCode) {
        this.permissionCode = permissionCode;
        this.roleCode = roleCode;
    }

    public String permissionCode() {
        return permissionCode;
    }

    public String roleCode() {
        return roleCode;
    }

    public static OrganizationPermissionDefinition fromCode(String permissionCode) {
        if (permissionCode != null) {
            String requested = permissionCode.trim();
            return Arrays.stream(values())
                    .filter(permission -> permission.permissionCode.equalsIgnoreCase(requested))
                    .findFirst()
                    .orElseThrow(() -> notFound(permissionCode));
        }
        throw notFound(null);
    }

    private static NotFoundException notFound(String permissionCode) {
        return new NotFoundException("Unsupported organization permission: " + permissionCode);
    }
}
