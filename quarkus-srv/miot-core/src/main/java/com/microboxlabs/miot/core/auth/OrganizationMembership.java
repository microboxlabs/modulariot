package com.microboxlabs.miot.core.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Deployment-wide override of each organization's {@code membership_source}, from {@value #PROPERTY}: {@code native}
 * makes membership of every organization come from the modulith, as a deployment without Alfresco needs. Any other
 * value leaves each organization's own setting in force.
 */
@ApplicationScoped
public class OrganizationMembership {

    public static final String PROPERTY = "miot.organizations.membership";
    public static final String NATIVE = "native";

    private final boolean nativeMembership;

    @Inject
    public OrganizationMembership(@ConfigProperty(name = PROPERTY, defaultValue = "alfresco") String membership) {
        this.nativeMembership = NATIVE.equalsIgnoreCase(membership.trim());
    }

    public boolean isNative() {
        return nativeMembership;
    }
}
