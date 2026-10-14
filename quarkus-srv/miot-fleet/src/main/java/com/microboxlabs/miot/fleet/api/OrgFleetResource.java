package com.microboxlabs.miot.fleet.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.fleet.access.FleetAccessCatalog;
import com.microboxlabs.miot.fleet.directory.AssetKind;
import com.microboxlabs.miot.fleet.directory.AssetQuery;
import com.microboxlabs.miot.fleet.directory.AssetStatus;
import com.microboxlabs.miot.fleet.directory.FleetDirectoryService;
import com.microboxlabs.miot.fleet.directory.FleetDirectoryService.Viewer;
import com.microboxlabs.miot.fleet.directory.FleetUnavailableException;
import com.microboxlabs.miot.fleet.directory.Views.AssetUpdate;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The organization's fleet: assets filled from GPS signals and trips, and the data people set by hand. */
@Path("/api/v1/orgs/{organizationId}/fleet")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Fleet", description = "Assets, their trips, documents and indicators")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class OrgFleetResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final SecurityIdentity identity;
    private final FleetDirectoryService fleet;

    @Inject
    public OrgFleetResource(TenantContext tenantContext, OrganizationContext organizationContext,
            SecurityIdentity identity, FleetDirectoryService fleet) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.identity = identity;
        this.fleet = fleet;
    }

    @GET
    @Path("/assets")
    @Operation(operationId = "listFleetAssets", summary = "Assets of the organization, filtered and paged")
    @PermissionsAllowed(value = FleetAccessCatalog.ASSETS_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> assets(@PathParam("organizationId") String organizationId, @QueryParam("q") String q,
            @QueryParam("kind") String kind, @QueryParam("status") String status,
            @QueryParam("carrier") String carrier, @QueryParam("suggestions") boolean suggestions,
            @QueryParam("documentsDue") boolean documentsDue, @QueryParam("sort") String sort,
            @QueryParam("page") @DefaultValue("0") int page, @QueryParam("size") @DefaultValue("50") int size) {
        Viewer viewer = viewer(organizationId);
        AssetQuery query = new AssetQuery(q, parse(kind, AssetKind::valueOf), parse(status, AssetStatus::valueOf),
                blank(carrier), suggestions, documentsDue, sort, page, size);
        return work(() -> fleet.list(viewer, query));
    }

    @GET
    @Path("/assets/{assetId}")
    @Operation(operationId = "getFleetAsset", summary = "One asset with its fields, trips, documents and indicators")
    @PermissionsAllowed(value = FleetAccessCatalog.ASSETS_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> asset(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId) {
        Viewer viewer = viewer(organizationId);
        return work(() -> fleet.asset(viewer, assetId));
    }

    @GET
    @Path("/assets/{assetId}/activity")
    @Operation(operationId = "getFleetAssetActivity", summary = "Daily engine hours, idle time and distance")
    @PermissionsAllowed(value = FleetAccessCatalog.ASSETS_VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> activity(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId, @QueryParam("days") @DefaultValue("14") int days) {
        Viewer viewer = viewer(organizationId);
        return work(() -> fleet.activity(viewer, assetId, days));
    }

    @PATCH
    @Path("/assets/{assetId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(operationId = "updateFleetAsset",
            summary = "Set or clear fields and document dates; a cleared field is filled by the integrations again")
    @PermissionsAllowed(value = FleetAccessCatalog.ASSETS_EDIT, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> update(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId, AssetUpdate update) {
        Viewer viewer = viewer(organizationId);
        String actor = actor();
        AssetUpdate body = update == null ? new AssetUpdate(Map.of(), Map.of()) : update;
        return work(() -> fleet.update(viewer, assetId, body, actor));
    }

    @POST
    @Path("/assets/{assetId}/suggestions/{kind}/accept")
    @Operation(operationId = "acceptFleetSuggestion", summary = "Apply a suggestion to its field")
    @PermissionsAllowed(value = FleetAccessCatalog.ASSETS_EDIT, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> accept(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId, @PathParam("kind") String kind) {
        Viewer viewer = viewer(organizationId);
        String actor = actor();
        return work(() -> fleet.accept(viewer, assetId, kind, actor));
    }

    @POST
    @Path("/assets/{assetId}/suggestions/{kind}/dismiss")
    @Operation(operationId = "dismissFleetSuggestion", summary = "Stop suggesting this value")
    @PermissionsAllowed(value = FleetAccessCatalog.ASSETS_EDIT, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> dismiss(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId, @PathParam("kind") String kind) {
        Viewer viewer = viewer(organizationId);
        String actor = actor();
        return work(() -> fleet.dismiss(viewer, assetId, kind, actor));
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
        String tenantCode = tenantContext.getTenantCode() != null ? tenantContext.getTenantCode()
                : tenantContext.getClientId();
        return new Viewer(organizationId, clientIds, tenantCode);
    }

    /** The user's email for a session token, the client id for an M2M token. */
    private String actor() {
        String email = organizationContext.getUserEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }
        return identity != null && identity.getPrincipal() != null ? identity.getPrincipal().getName() : null;
    }

    private static <T> T parse(String value, Function<String, T> parser) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return parser.apply(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new WebApplicationException(error(Response.Status.BAD_REQUEST, "Unknown value: " + value));
        }
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
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
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (FleetUnavailableException e) {
            return error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    private static Response error(Response.Status status, String message) {
        return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build();
    }
}
