package com.microboxlabs.miot.core.permission;

import java.util.Set;

/**
 * Organization roles a module adds to {@value OrganizationRoleService#OWNER_ROLE_CODE}. The role
 * administration API accepts only these codes, and the module decides what each one allows.
 */
public interface OrganizationRoleCatalog {

    Set<String> roleCodes();
}
