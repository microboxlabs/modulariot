package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.catalog.service.RuleDescriptionService;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.ws.rs.core.Response;

/**
 * Shared plumbing for the Control Tower resources: {@link OrgResourceSupport}, plus an unavailable
 * Harness as a 503. Each endpoint declares the permission it needs with {@code @PermissionsAllowed};
 * see {@code ControlTowerAccessCatalog}.
 */
abstract class ControlTowerResourceSupport extends OrgResourceSupport {

    protected ControlTowerResourceSupport(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity) {
        super(tenantContext, organizationContext, roleService, identity);
    }

    /** The caller's identity as the Harness expects it. */
    protected RuleDescriptionService.Caller harnessCaller(String authorization) {
        return new RuleDescriptionService.Caller(authorization, tenantContext().getClientId(),
                organizationContext().getUserEmail());
    }

    @Override
    protected Response unmapped(RuntimeException e) {
        return e instanceof RuleDescriptionService.UnavailableException
                ? error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage())
                : super.unmapped(e);
    }

    protected static long parseSymptomId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("symptomId must be numeric");
        }
    }
}
