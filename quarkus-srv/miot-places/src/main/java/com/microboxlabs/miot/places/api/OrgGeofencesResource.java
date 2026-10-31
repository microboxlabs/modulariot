package com.microboxlabs.miot.places.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.places.access.PlacesAccessCatalog;
import com.microboxlabs.miot.places.dto.GeofenceView;
import com.microboxlabs.miot.places.service.GeofenceService;
import com.microboxlabs.miot.places.service.GeofenceOrganizationScope;
import com.microboxlabs.miot.places.store.GeofencesUnavailableException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The organization's GPS geofences, read from the streamhub GPS database. 503 when that database is not configured. */
@Path("/api/v1/orgs/{organizationId}/places/geofences")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Places — Geofences", description = "The organization's GPS geofences")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class OrgGeofencesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final GeofenceService geofences;
    private final GeofenceOrganizationScope sourceScope;

    @Inject
    public OrgGeofencesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            GeofenceService geofences,
            GeofenceOrganizationScope sourceScope) {
        super(tenantContext, organizationContext, roleService, identity);
        this.geofences = geofences;
        this.sourceScope = sourceScope;
    }

    @GET
    @Operation(operationId = "listGeofences", summary = "The organization's geofences with their shapes")
    @PermissionsAllowed(value = {PlacesAccessCatalog.VIEW, PlacesAccessCatalog.CONTROL_TOWER_VIEW},
            permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(@PathParam(ORG) String organizationId, @QueryParam("q") String q,
            @QueryParam("size") String size, @QueryParam("page") String page) {
        String tenant = tenantCode(organizationId);
        return sourceScope.allows(organizationId).flatMap(allowed -> {
            if (!Boolean.TRUE.equals(allowed)) {
                return Uni.createFrom().item(error(Response.Status.FORBIDDEN,
                        "The sub-account has no organization-specific geofence source"));
            }
            return work(() -> Response.ok(geofences.list(tenant, q, integer(size, "size"), integer(page, "page"))
                    .stream().map(GeofenceView::of).toList()).build());
        });
    }

    @Override
    protected Response unmapped(RuntimeException e) {
        if (e instanceof GeofencesUnavailableException) {
            return error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage());
        }
        throw e;
    }
}
