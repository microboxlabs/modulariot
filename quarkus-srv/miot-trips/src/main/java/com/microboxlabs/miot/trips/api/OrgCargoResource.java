package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.CargoRequest;
import com.microboxlabs.miot.trips.dto.CargoView;
import com.microboxlabs.miot.trips.dto.ReceiveRequest;
import com.microboxlabs.miot.trips.service.CargoService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Cargo units: the indivisible pieces the cargo provider announces against a mandate line. */
@Path("/api/v1/orgs/{organizationId}/trips")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Cargo", description = "Cargo units: announce, patch, receive")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgCargoResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final CargoService cargo;

    @Inject
    public OrgCargoResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            CargoService cargo) {
        super(tenantContext, organizationContext, roleService, identity);
        this.cargo = cargo;
    }

    @GET
    @Path("/mandates/{mandateId}/cargo")
    @Operation(operationId = "listCargo", summary = "Cargo units of the mandate, by partial number")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(@PathParam(ORG) String organizationId, @PathParam("mandateId") String mandateId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                cargo.listByMandate(tenant, uuid(mandateId, "mandateId")).stream().map(CargoView::of).toList())
                .build());
    }

    @POST
    @Path("/mandates/{mandateId}/cargo")
    @Operation(operationId = "announceCargo",
            summary = "Announce a cargo unit (a partial) against the mandate's line")
    @PermissionsAllowed(value = TripsAccessCatalog.CARGO_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> announce(@PathParam(ORG) String organizationId, @PathParam("mandateId") String mandateId,
            CargoRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(CargoView.of(cargo.announce(tenant, actor, uuid(mandateId, "mandateId"), body)))
                .build());
    }

    @PATCH
    @Path("/cargo/{cargoId}")
    @Operation(operationId = "updateCargo",
            summary = "Patch a cargo unit; status only moves forward within the announce stage")
    @PermissionsAllowed(value = TripsAccessCatalog.CARGO_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam("cargoId") String cargoId,
            CargoRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(CargoView.of(cargo.update(tenant, actor, uuid(cargoId, "cargoId"), body)))
                .build());
    }

    @POST
    @Path("/cargo/{cargoId}/receive")
    @Operation(operationId = "receiveCargo",
            summary = "Receive a delivered cargo unit: conforming | discrepancy (notes required on discrepancy)")
    @PermissionsAllowed(value = TripsAccessCatalog.CARGO_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> receive(@PathParam(ORG) String organizationId, @PathParam("cargoId") String cargoId,
            ReceiveRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(CargoView.of(cargo.receive(tenant, actor, uuid(cargoId, "cargoId"), body)))
                .build());
    }
}
