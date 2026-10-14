package com.microboxlabs.miot.fleet.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.fleet.access.FleetAccessCatalog;
import com.microboxlabs.miot.fleet.network.FleetNetworkService;
import com.microboxlabs.miot.fleet.network.NetworkUnavailableException;
import com.microboxlabs.miot.fleet.network.Viewer;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashSet;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The assets the organization sees and its relationships with other organizations. 503 when no source is set. */
@Path("/api/v1/orgs/{organizationId}/fleet/network")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Fleet — Network", description = "Assets reported by GPS and the organizations that share them")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class OrgFleetNetworkResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final FleetNetworkService network;

    @Inject
    public OrgFleetNetworkResource(TenantContext tenantContext, OrganizationContext organizationContext,
            FleetNetworkService network) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.network = network;
    }

    @GET
    @Path("/assets")
    @Operation(operationId = "listNetworkAssets", summary = "Assets the organization sees, with the reason for each")
    @PermissionsAllowed(value = FleetAccessCatalog.NETWORK_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> assets(@PathParam("organizationId") String organizationId) {
        Viewer viewer = viewer(organizationId);
        return work(() -> network.assets(viewer));
    }

    @GET
    @Path("/assets/{assetId}")
    @Operation(operationId = "getNetworkAsset", summary = "One asset the organization sees")
    @PermissionsAllowed(value = FleetAccessCatalog.NETWORK_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> asset(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId) {
        Viewer viewer = viewer(organizationId);
        return work(() -> network.asset(viewer, assetId));
    }

    @GET
    @Path("/relationships")
    @Operation(operationId = "listNetworkRelationships",
            summary = "Organizations this one works with, inferred from shared assets")
    @PermissionsAllowed(value = FleetAccessCatalog.NETWORK_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> relationships(@PathParam("organizationId") String organizationId) {
        Viewer viewer = viewer(organizationId);
        return work(() -> network.relationships(viewer));
    }

    private Viewer viewer(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(error(Response.Status.FORBIDDEN,
                    "Organization context does not match request path"));
        }
        Set<String> clientIds = new HashSet<>();
        if (tenantContext.getClientId() != null) {
            clientIds.addAll(tenantContext.getEffectiveClientIds());
        }
        return new Viewer(organizationId, clientIds);
    }

    private static Uni<Response> work(Supplier<Object> read) {
        return Uni.createFrom().item(() -> answer(read))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private static Response answer(Supplier<Object> read) {
        try {
            return Response.ok(read.get()).build();
        } catch (NoSuchElementException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        } catch (NetworkUnavailableException e) {
            return error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }
}
