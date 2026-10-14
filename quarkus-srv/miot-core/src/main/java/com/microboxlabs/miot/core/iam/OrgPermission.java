package com.microboxlabs.miot.core.iam;

import java.security.Permission;
import java.util.Objects;

/**
 * A permission in one organization, for {@code @PermissionsAllowed}. The organization comes from the endpoint's
 * {@code organizationId} path parameter:
 *
 * <pre>{@code
 * @PermissionsAllowed(value = "controltower:symptom.publish", permission = OrgPermission.class,
 *         params = "organizationId")
 * }</pre>
 *
 * {@link IamIdentityAugmentor} answers it through {@link AccessEvaluator}. Quarkus splits the value at the first
 * {@code :} into a name and an action; the constructor joins them back into the permission key.
 */
public final class OrgPermission extends Permission {

    private final String organizationId;

    public OrgPermission(String name, String[] actions, String organizationId) {
        super(actions == null || actions.length == 0 ? name : name + ":" + String.join(",", actions));
        this.organizationId = organizationId;
    }

    /** For callers outside {@code @PermissionsAllowed}: {@code key} is the whole permission key. */
    public static OrgPermission of(String key, String organizationId) {
        return new OrgPermission(key, null, organizationId);
    }

    public String organizationId() {
        return organizationId;
    }

    /** Never implied by another permission: only the evaluator decides. */
    @Override
    public boolean implies(Permission permission) {
        return false;
    }

    @Override
    public String getActions() {
        return "";
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof OrgPermission that
                && getName().equals(that.getName())
                && Objects.equals(organizationId, that.organizationId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(getName(), organizationId);
    }
}
