package com.microboxlabs.miot.symptoms.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.map.ControlTowerMapService;
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
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The map and the dashboard counters, read from the GPS database as the organization. Answers 503 when the GPS data
 * cannot be read.
 */
@Path("/api/v1/orgs/{organizationId}/control-tower/map")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Map", description = "Asset positions and symptom counts from the GPS database")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerMapResource extends ControlTowerResourceSupport {

    private final TenantContext tenantContext;
    private final ControlTowerMapService map;

    @Inject
    public OrgControlTowerMapResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            ControlTowerMapService map) {
        super(tenantContext, organizationContext, roleService, identity);
        this.tenantContext = tenantContext;
        this.map = map;
    }

    @GET
    @Path("/positions")
    @Operation(operationId = "listMapPositions", summary = "Last position of each of the organization's assets")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> positions(@PathParam("organizationId") String organizationId) {
        tenantCode(organizationId);
        return answer(() -> map.positions(tenantContext.getClientId()));
    }

    @GET
    @Path("/summary")
    @Operation(operationId = "getMapSummary", summary = "Service, fleet and symptom totals shown beside the map")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> summary(@PathParam("organizationId") String organizationId) {
        tenantCode(organizationId);
        return answer(() -> map.summary(tenantContext.getClientId()));
    }

    @GET
    @Path("/conditions")
    @Operation(operationId = "countSymptomConditions", summary = "Symptom counts by condition",
            description = "Active symptoms, or with from and to (ISO-8601) the symptoms created in that range.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> conditions(
            @PathParam("organizationId") String organizationId,
            @QueryParam("from") String from,
            @QueryParam("to") String to) {
        tenantCode(organizationId);
        return answer(() -> map.conditions(tenantContext.getClientId(), from, to));
    }

    private static Uni<Response> answer(Supplier<Uni<JsonNode>> read) {
        Uni<JsonNode> data;
        try {
            data = read.get();
        } catch (IllegalArgumentException e) {
            return Uni.createFrom().item(error(Response.Status.BAD_REQUEST, e.getMessage()));
        }
        return data.map(body -> Response.ok(body).build())
                .onFailure(ControlTowerMapService.UnavailableException.class)
                .recoverWithItem(e -> error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage()));
    }
}
