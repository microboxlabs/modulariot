package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.MonitorViews;
import com.microboxlabs.miot.trips.service.MonitorService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The ordered (condition, monitor) pairs that pick the monitor of a trip created without one. */
@Path("/api/v1/orgs/{organizationId}/trips/monitor-selector")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Monitors", description = "Versioned transition rules for each class of trip")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgMonitorSelectorResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final MonitorService monitors;

    @Inject
    public OrgMonitorSelectorResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            MonitorService monitors) {
        super(tenantContext, organizationContext, roleService, identity);
        this.monitors = monitors;
    }

    @GET
    @Operation(operationId = "getMonitorSelector", summary = "The organization's selector, in evaluation order")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(monitors.selector(tenant)).build());
    }

    @PUT
    @Operation(operationId = "saveMonitorSelector",
            summary = "Replaces the selector; each condition must compile and each monitor be published")
    @PermissionsAllowed(value = TripsAccessCatalog.MONITOR_ADMIN, permission = OrgPermission.class, params = ORG)
    public Uni<Response> save(@PathParam(ORG) String organizationId, MonitorViews.SelectorRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(monitors.saveSelector(tenant, actor, body)).build());
    }
}
