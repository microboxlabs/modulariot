package com.microboxlabs.miot.symptoms.access;

import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import java.util.EnumSet;
import java.util.Set;

/**
 * What a caller may do in the control tower.
 *
 * <table>
 *   <caption>Roles</caption>
 *   <tr><th>Role</th><th>Permissions</th></tr>
 *   <tr><td>{@value OrganizationRoleService#OWNER_ROLE_CODE}, {@value ControlTowerRoles#MAINTAINER}</td>
 *       <td>VIEW, OPERATE, MAINTAIN</td></tr>
 *   <tr><td>{@value ControlTowerRoles#OPERATOR}</td><td>VIEW, OPERATE</td></tr>
 *   <tr><td>{@value ControlTowerRoles#VIEWER}</td><td>VIEW</td></tr>
 * </table>
 *
 * <p>With Alfresco membership, a member without a control tower role keeps VIEW and OPERATE, as before
 * the roles existed. With native membership, a member gets only what their roles give.
 */
public enum ControlTowerPermission {
    /** Read the tower, the catalog and its numbers. */
    VIEW,
    /** Treat cases and edit contacts. */
    OPERATE,
    /** Edit and publish symptoms, change the tower settings and delete contacts. */
    MAINTAIN;

    public static Set<ControlTowerPermission> granted(Set<String> roles, boolean nativeMembership) {
        if (roles.contains(OrganizationRoleService.OWNER_ROLE_CODE) || roles.contains(ControlTowerRoles.MAINTAINER)) {
            return EnumSet.allOf(ControlTowerPermission.class);
        }
        if (roles.contains(ControlTowerRoles.OPERATOR)) {
            return EnumSet.of(VIEW, OPERATE);
        }
        if (roles.contains(ControlTowerRoles.VIEWER)) {
            return EnumSet.of(VIEW);
        }
        return nativeMembership ? EnumSet.noneOf(ControlTowerPermission.class) : EnumSet.of(VIEW, OPERATE);
    }
}
