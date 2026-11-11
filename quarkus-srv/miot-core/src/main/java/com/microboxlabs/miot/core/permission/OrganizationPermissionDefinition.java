package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
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
            CoreAccessCatalog.CONTENT_AUTO_APPROVE,
            false),
    /** Reviews learned facts and manages the chat agent's knowledge cards. */
    HARNESS_TRAINER(
            "HARNESS_TRAINER",
            "HARNESS_TRAINER",
            CoreAccessCatalog.HARNESS_TRAIN,
            true);

    private final String permissionCode;
    private final String roleCode;
    private final String accessPermission;
    private final boolean grantedToOwners;

    OrganizationPermissionDefinition(
            String permissionCode, String roleCode, String accessPermission, boolean grantedToOwners) {
        this.permissionCode = permissionCode;
        this.roleCode = roleCode;
        this.accessPermission = accessPermission;
        this.grantedToOwners = grantedToOwners;
    }

    public String permissionCode() {
        return permissionCode;
    }

    public String roleCode() {
        return roleCode;
    }

    /** The access catalog permission that the role gives; any role holding it grants this permission. */
    public String accessPermission() {
        return accessPermission;
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
