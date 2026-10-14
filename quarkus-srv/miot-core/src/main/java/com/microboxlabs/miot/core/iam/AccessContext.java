package com.microboxlabs.miot.core.iam;

import io.quarkus.arc.Unremovable;
import jakarta.enterprise.context.RequestScoped;
import java.util.HashMap;
import java.util.Map;

/**
 * Decisions already made in this request, so the org filter and the permission checks evaluate once. Looked up
 * programmatically by {@link AccessEvaluator}, hence unremovable.
 */
@RequestScoped
@Unremovable
public class AccessContext {

    private final Map<String, Access> decisions = new HashMap<>();

    Access get(String organizationSlug, Caller caller) {
        return decisions.get(organizationSlug + "|" + caller.key());
    }

    void put(String organizationSlug, Caller caller, Access access) {
        decisions.put(organizationSlug + "|" + caller.key(), access);
    }
}
