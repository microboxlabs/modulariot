package com.microboxlabs.miot.core.permission;

import jakarta.ws.rs.NotFoundException;
import java.util.Arrays;

/**
 * Supported application permissions, the application role that grants each one,
 * and whether organization owners hold it without an assignment.
 */
public enum OrganizationPermissionDefinition {

    CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE(
            "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE",
            "CONTENT_REVIEW_AUTO_APPROVER",
            false),
    /** Reviews learned facts and manages the chat agent's knowledge cards. */
    HARNESS_TRAINER(
            "HARNESS_TRAINER",
            "HARNESS_TRAINER",
            true);

    private final String permissionCode;
    private final String roleCode;
    private final boolean grantedToOwners;

    OrganizationPermissionDefinition(
            String permissionCode, String roleCode, boolean grantedToOwners) {
        this.permissionCode = permissionCode;
        this.roleCode = roleCode;
        this.grantedToOwners = grantedToOwners;
    }

    public String permissionCode() {
        return permissionCode;
    }

    public String roleCode() {
        return roleCode;
    }

    public boolean grantedToOwners() {
        return grantedToOwners;
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
