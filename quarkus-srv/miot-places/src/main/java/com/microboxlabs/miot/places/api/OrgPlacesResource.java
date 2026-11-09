package com.microboxlabs.miot.places.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.places.access.PlacesAccessCatalog;
import com.microboxlabs.miot.places.dto.CodeUsageView;
import com.microboxlabs.miot.places.dto.PlaceRequest;
import com.microboxlabs.miot.places.dto.PlaceVersionView;
import com.microboxlabs.miot.places.dto.PlaceView;
import com.microboxlabs.miot.places.service.GeofenceOrganizationScope;
import com.microboxlabs.miot.places.service.PlaceService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
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
 * The organization's saved places ({@code miot_places}): geofences, inner geofences and routes. A geofence is saved
 * with its inner geofences, and every edit of a geofence or route is a version. Reading needs
 * {@value PlacesAccessCatalog#VIEW} (every member); saving needs {@value PlacesAccessCatalog#WRITE} (Lugares ›
 * Mantenedor, or an Admin or Owner).
 */
@Path("/api/v1/orgs/{organizationId}/places/items")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Places — Saved places", description = "The organization's geofences, inner geofences and routes")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class OrgPlacesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String PLACE_ID = "placeId";

    private final PlaceService places;
    private final GeofenceOrganizationScope sourceScope;

    @Inject
    public OrgPlacesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            PlaceService places,
            GeofenceOrganizationScope sourceScope) {
        super(tenantContext, organizationContext, roleService, identity);
        this.places = places;
        this.sourceScope = sourceScope;
    }

    @GET
    @Operation(operationId = "listPlaces", summary = "The organization's places; filter by kind, parent and search")
    @PermissionsAllowed(value = PlacesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId, @QueryParam("kind") String kind,
            @QueryParam("parentId") String parentId, @QueryParam("q") String q, @QueryParam("size") String size,
            @QueryParam("page") String page) {
        String tenant = tenantCode(organizationId);
        return scoped(organizationId, () -> Response.ok(places.list(tenant, kind,
                        parentId == null || parentId.isBlank() ? null : uuid(parentId, "parentId"), q,
                        integer(size, "size"), integer(page, "page"))
                .stream().map(PlaceView::of).toList()).build());
    }

    @GET
    @Path("/code-usage")
    @Operation(operationId = "getPlaceCodeUsage", summary = "Whether an external code is taken in the organization")
    @PermissionsAllowed(value = PlacesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> codeUsage(@PathParam(ORG) String organizationId, @QueryParam("code") String code) {
        String tenant = tenantCode(organizationId);
        return scoped(organizationId, () -> Response.ok(CodeUsageView.of(places.codeOwner(tenant, code))).build());
    }

    @GET
    @Path("/{placeId}")
    @Operation(operationId = "getPlace", summary = "One place; a geofence with its inner geofences")
    @PermissionsAllowed(value = PlacesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam(PLACE_ID) String placeId) {
        String tenant = tenantCode(organizationId);
        return scoped(organizationId,
                () -> Response.ok(view(places.getWithInners(tenant, uuid(placeId, PLACE_ID)))).build());
    }

    @GET
    @Path("/{placeId}/versions")
    @Operation(operationId = "listPlaceVersions", summary = "The versions of a geofence or route, oldest first")
    @PermissionsAllowed(value = PlacesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> versions(@PathParam(ORG) String organizationId, @PathParam(PLACE_ID) String placeId) {
        String tenant = tenantCode(organizationId);
        return scoped(organizationId, () -> Response.ok(places.versions(tenant, uuid(placeId, PLACE_ID)).stream()
                .map(PlaceVersionView::of).toList()).build());
    }

    @POST
    @Operation(operationId = "createPlace",
            summary = "Saves a new geofence, with its inner geofences, or route; it starts at 1.0.0")
    @PermissionsAllowed(value = PlacesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> create(@PathParam(ORG) String organizationId, PlaceRequest request) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return scoped(organizationId, () -> Response.status(Response.Status.CREATED)
                .entity(view(places.create(tenant, request, actor))).build());
    }

    @PUT
    @Path("/{placeId}")
    @Operation(operationId = "updatePlace",
            summary = "Replaces a geofence, with its inner geofences, or route as its next version")
    @PermissionsAllowed(value = PlacesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam(PLACE_ID) String placeId,
            PlaceRequest request) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return scoped(organizationId,
                () -> Response.ok(view(places.update(tenant, uuid(placeId, PLACE_ID), request, actor))).build());
    }

    @DELETE
    @Operation(operationId = "deletePlace",
            summary = "Deletes the geofence, with its inner geofences, or route that holds an external code")
    @PermissionsAllowed(value = PlacesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> delete(@PathParam(ORG) String organizationId, @QueryParam("code") String code) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return scoped(organizationId, () -> {
            places.delete(tenant, code, actor);
            return Response.noContent().build();
        });
    }

    private static PlaceView view(PlaceService.Saved saved) {
        return PlaceView.of(saved.place(), saved.inners());
    }

    /** The store is keyed by tenant client id; a shared-client sub-account must never enter its parent's data. */
    private Uni<Response> scoped(String organizationId, Supplier<Response> action) {
        return sourceScope.allows(organizationId).flatMap(allowed -> {
            if (!Boolean.TRUE.equals(allowed)) {
                return Uni.createFrom().item(error(Response.Status.FORBIDDEN,
                        "The sub-account has no organization-specific places source"));
            }
            return work(action);
        });
    }
}
