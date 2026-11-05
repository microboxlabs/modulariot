package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.TripLiveView;
import com.microboxlabs.miot.trips.store.TripLiveStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.NoSuchElementException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The hot projection, read-only: triggers derive it from the registry, the motor writes its state fields. */
@Path("/api/v1/orgs/{organizationId}/trips/live")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Live", description = "The hot rows of the org's running trips")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripsLiveResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final TripLiveStore live;

    @Inject
    public OrgTripsLiveResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            TripLiveStore live) {
        super(tenantContext, organizationContext, roleService, identity);
        this.live = live;
    }

    @GET
    @Operation(operationId = "listLive", summary = "The org's hot rows — the board")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(live.list(tenant).stream().map(TripLiveView::of).toList()).build());
    }

    @GET
    @Path("/{tripId}")
    @Operation(operationId = "getLive", summary = "One hot row")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam("tripId") String tripId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(TripLiveView.of(
                live.find(tenant, uuid(tripId, "tripId"))
                        .orElseThrow(() -> new NoSuchElementException("hot row not found"))))
                .build());
    }
}
