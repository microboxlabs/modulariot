package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.LinkMandateRequest;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.service.TripService;
import com.microboxlabs.miot.trips.service.TripGeofenceService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Trips: the legs; linking mandates to a trip is the multicliente convergence. */
@Path("/api/v1/orgs/{organizationId}/trips/trips")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Trips", description = "Legs: create with plan, file, link mandates, cancel")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripsResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final TripService trips;
    private final TripGeofenceService geofences;

    @Inject
    public OrgTripsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            TripService trips,
            TripGeofenceService geofences) {
        super(tenantContext, organizationContext, roleService, identity);
        this.trips = trips;
        this.geofences = geofences;
    }

    @GET
    @Operation(operationId = "listTrips", summary = "Trips, newest first; filter by status, mandate, asset or window")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(
            @PathParam(ORG) String organizationId,
            @QueryParam("status") String status,
            @QueryParam("mandateId") String mandateId,
            @QueryParam("assetId") String assetId,
            @QueryParam("from") String from,
            @QueryParam("to") String to,
            @QueryParam("page") String page,
            @QueryParam("size") String size) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                trips.list(tenant,
                        TripService.filter(status, mandateId, assetId, timestamp(from, "from"), timestamp(to, "to")),
                        integer(page, "page"), integer(size, "size")).stream().map(TripView::of).toList())
                .build());
    }

    @POST
    @Operation(operationId = "createTrip", summary = "Creates the leg with its planned stages and mandates")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> create(@PathParam(ORG) String organizationId, TripRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(trips.create(tenant, actor, body)).build());
    }

    @GET
    @Path("/{id}/geofences")
    @Operation(operationId = "getTripGeofences", summary = "The trip's origin, destination and stop geofences")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> geofences(@PathParam(ORG) String organizationId, @PathParam("id") String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(geofences.geofences(tenant, uuid(id, "id"))).build());
    }

    @GET
    @Path("/{id}")
    @Operation(operationId = "getTrip", summary = "The trip's file: mandates, stages, assignments and cargo")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam("id") String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(trips.detail(tenant, uuid(id, "id"))).build());
    }

    @PATCH
    @Path("/{id}")
    @Operation(operationId = "updateTrip", summary = "Patch the leg or the planned start")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            TripRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(TripView.of(trips.update(tenant, actor, uuid(id, "id"), body))).build());
    }

    @POST
    @Path("/{id}/mandates")
    @Operation(operationId = "linkTripMandate",
            summary = "Links a mandate — the convergence: 201 when linked, 200 when it already was")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> linkMandate(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            LinkMandateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            boolean linked = trips.linkMandate(tenant, actor, uuid(id, "id"),
                    body == null ? null : body.mandateId(), body == null ? null : body.seq(),
                    body == null ? null : body.role());
            return Response.status(linked ? Response.Status.CREATED : Response.Status.OK)
                    .entity(trips.mandatesOf(tenant, uuid(id, "id"))).build();
        });
    }

    @DELETE
    @Path("/{id}/mandates/{mandateId}")
    @Operation(operationId = "unlinkTripMandate",
            summary = "Unlinks the mandate; 409 while its cargo rides on the trip")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> unlinkMandate(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            @PathParam("mandateId") String mandateId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            trips.unlinkMandate(tenant, actor, uuid(id, "id"), uuid(mandateId, "mandateId"));
            return Response.noContent().build();
        });
    }

    @POST
    @Path("/{id}/cancel")
    @Operation(operationId = "cancelTrip", summary = "Cancels with a reason; the hot row dies with it")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> cancel(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            Map<String, String> body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(TripView.of(
                trips.cancel(tenant, actor, uuid(id, "id"), body == null ? null : body.get("reason"))))
                .build());
    }

    static OffsetDateTime timestamp(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(field + " must be an ISO-8601 timestamp");
        }
    }
}
