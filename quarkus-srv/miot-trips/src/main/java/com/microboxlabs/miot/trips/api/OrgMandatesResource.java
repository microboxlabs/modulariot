package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.MandateView;
import com.microboxlabs.miot.trips.service.CargoService;
import com.microboxlabs.miot.trips.service.MandateService;
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
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Mandates: the order header a mandante places. Creation is create-or-return by (tenant, externalCode). */
@Path("/api/v1/orgs/{organizationId}/trips/mandates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Mandates", description = "Order headers: create-or-return, list, close, cancel")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgMandatesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final MandateService mandates;
    private final CargoService cargo;

    @Inject
    public OrgMandatesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            MandateService mandates,
            CargoService cargo) {
        super(tenantContext, organizationContext, roleService, identity);
        this.mandates = mandates;
        this.cargo = cargo;
    }

    @GET
    @Operation(operationId = "listMandates", summary = "Mandates, newest first; filter by status or externalCode")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(
            @PathParam(ORG) String organizationId,
            @QueryParam("status") String status,
            @QueryParam("externalCode") String externalCode,
            @QueryParam("page") String page,
            @QueryParam("size") String size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                mandates.list(tenant, status, externalCode, integer(page, "page"), integer(size, "size")).stream().map(MandateView::of).toList())
                .build());
    }

    @POST
    @Operation(operationId = "createMandate",
            summary = "Create-or-return by (tenant, externalCode): 201 when created, 200 when it already existed")
    @PermissionsAllowed(value = TripsAccessCatalog.MANDATE_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> create(@PathParam(ORG) String organizationId, MandateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            MandateService.CreateOrGet result = mandates.createOrGet(tenant, actor, body);
            Response.Status status = result.created() ? Response.Status.CREATED : Response.Status.OK;
            return Response.status(status).entity(MandateView.of(result.mandate())).build();
        });
    }

    @GET
    @Path("/{id}")
    @Operation(operationId = "getMandate", summary = "The mandate with its cargo and linked trips")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam("id") String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            UUID mandateId = uuid(id, "id");
            return Response.ok(MandateView.of(
                    mandates.get(tenant, mandateId),
                    cargo.listByMandate(tenant, mandateId),
                    mandates.tripsOf(tenant, mandateId))).build();
        });
    }

    @PATCH
    @Path("/{id}")
    @Operation(operationId = "updateMandate", summary = "Patch header data; null keeps, \"\" clears")
    @PermissionsAllowed(value = TripsAccessCatalog.MANDATE_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            MandateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(MandateView.of(mandates.update(tenant, actor, uuid(id, "id"), body)))
                .build());
    }

    @POST
    @Path("/{id}/close")
    @Operation(operationId = "closeMandate",
            summary = "Close; 409 while a linked trip is not completed or cancelled")
    @PermissionsAllowed(value = TripsAccessCatalog.MANDATE_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> close(@PathParam(ORG) String organizationId, @PathParam("id") String id) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(MandateView.of(mandates.close(tenant, actor, uuid(id, "id")))).build());
    }

    @POST
    @Path("/{id}/cancel")
    @Operation(operationId = "cancelMandate", summary = "Cancel with a reason")
    @PermissionsAllowed(value = TripsAccessCatalog.MANDATE_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> cancel(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            Map<String, String> body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(MandateView.of(
                mandates.cancel(tenant, actor, uuid(id, "id"), body == null ? null : body.get("reason"))))
                .build());
    }
}
