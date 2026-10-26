package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseService;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.map.ControlTowerMapService;
import com.microboxlabs.miot.symptoms.map.ControlTowerTreatmentService;
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
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The map, the dashboard counters and the treatment page, read from the GPS database as the organization. Answers
 * 404 for a symptom or trip outside the organization, and 503 when the GPS data cannot be read.
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
    private final ControlTowerTreatmentService treatments;
    private final EngineCaseService cases;

    @Inject
    public OrgControlTowerMapResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            ControlTowerMapService map,
            ControlTowerTreatmentService treatments,
            EngineCaseService cases) {
        super(tenantContext, organizationContext, roleService, identity);
        this.tenantContext = tenantContext;
        this.map = map;
        this.treatments = treatments;
        this.cases = cases;
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
            description = "Active symptoms, with the evaluator's open cases, or with from and to (ISO-8601) the "
                    + "symptoms created in that range.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> conditions(
            @PathParam("organizationId") String organizationId,
            @QueryParam("from") String from,
            @QueryParam("to") String to) {
        String tenant = tenantCode(organizationId);
        return answer(() -> {
            Uni<JsonNode> gps = map.conditions(tenantContext.getClientId(), from, to);
            if (notBlank(from) || notBlank(to)) {
                return gps;
            }
            // As in the symptom list: the open cases count even when the GPS database cannot be read.
            return gps.onFailure(ControlTowerMapService.UnavailableException.class).recoverWithNull()
                    .emitOn(Infrastructure.getDefaultWorkerPool())
                    .map(counts -> {
                        JsonNode out = cases.withOpenCaseCounts(tenant, counts);
                        if (counts == null && out.isEmpty()) {
                            throw new ControlTowerMapService.UnavailableException("GPS data is not available");
                        }
                        return out;
                    });
        });
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    @GET
    @Path("/symptoms")
    @Operation(operationId = "listMapSymptoms", summary = "One page of the organization's symptoms, with totals",
            description = "Query parameters are the GPS database function's: p_asset_id, p_trip_id, p_driver_id, "
                    + "p_carrier_id, p_origin, p_destination, p_symptom_name, p_icu_code, p_page, p_page_size, "
                    + "p_start_date_historic, p_end_date_historic. Any other is a 400.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> symptoms(@PathParam("organizationId") String organizationId, @Context UriInfo uri) {
        tenantCode(organizationId);
        Map<String, String> filters = new LinkedHashMap<>();
        uri.getQueryParameters().forEach((name, values) -> filters.put(name, values.isEmpty() ? null : values.get(0)));
        String tenant = tenantCode(organizationId);
        return answer(() -> {
            Uni<JsonNode> gps = map.symptoms(tenantContext.getClientId(), filters);
            if (!EngineCaseService.showsCases(filters)) {
                return gps;
            }
            // The evaluator's cases go first; they still show when the GPS database cannot be read.
            return gps.onFailure(ControlTowerMapService.UnavailableException.class).recoverWithNull()
                    .emitOn(Infrastructure.getDefaultWorkerPool())
                    .map(page -> {
                        JsonNode out = cases.withCases(tenant, filters, page);
                        if (page == null && out.path("data").isEmpty()) {
                            throw new ControlTowerMapService.UnavailableException("GPS data is not available");
                        }
                        return out;
                    });
        });
    }

    @GET
    @Path("/symptoms/{symptomId}")
    @Operation(operationId = "getMapSymptom", summary = "One symptom with its trip, related symptoms and timeline",
            description = "404 when the symptom is not one of the organization's.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> symptom(@PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId) {
        String tenant = tenantCode(organizationId);
        if (engineCase(symptomId)) {
            return answer(() -> blocking(() -> cases.header(tenant, Long.parseLong(symptomId.trim()))));
        }
        return answer(() -> treatments.treatment(clientIds(), symptomId));
    }

    @GET
    @Path("/symptoms/{symptomId}/signals")
    @Operation(operationId = "getMapSymptomSignals", summary = "The signals of one symptom, as a FeatureCollection",
            description = "Geometries are hex EWKB. 404 when the symptom is not one of the organization's.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> symptomSignals(@PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId) {
        String tenant = tenantCode(organizationId);
        if (engineCase(symptomId)) {
            return answer(() -> blocking(() -> cases.signals(tenant, Long.parseLong(symptomId.trim()))));
        }
        return answer(() -> treatments.signals(clientIds(), symptomId));
    }

    @GET
    @Path("/symptoms/{symptomId}/positions")
    @Operation(operationId = "listMapSymptomPositions",
            summary = "The vehicle's positions around one of the evaluator's cases",
            description = "From an hour before the case opened, or from the vehicle's previous case when nearer, until "
                    + "the case closed or now; oldest first, at most 20000. Only for the evaluator's cases (negative "
                    + "ids): a symptom with a trip reads the trip's positions. 404 when the case is not the "
                    + "organization's.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> symptomPositions(@PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId) {
        String tenant = tenantCode(organizationId);
        if (!engineCase(symptomId)) {
            return Uni.createFrom().item(error(Response.Status.BAD_REQUEST,
                    "Only the evaluator's cases have positions here; read the trip's"));
        }
        long id = Long.parseLong(symptomId.trim());
        return answer(() -> Uni.createFrom().item(() -> cases.signalWindow(tenant, id))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .flatMap(w -> treatments.assetPositions(clientIds(), w.assetId(), w.from(), w.to())));
    }

    @GET
    @Path("/trips/{tripId}/positions")
    @Operation(operationId = "listMapTripPositions", summary = "The asset's positions during a trip, oldest first",
            description = "At most 20000, sampled evenly over the trip. 404 when the trip does not exist for the "
                    + "asset or the asset was not the organization's when the trip started.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> tripPositions(@PathParam("organizationId") String organizationId,
            @PathParam("tripId") String tripId, @QueryParam("assetId") String assetId) {
        tenantCode(organizationId);
        return answer(() -> treatments.tripPositions(clientIds(), tripId, assetId));
    }

    @GET
    @Path("/assets/{assetId}/positions")
    @Operation(operationId = "listMapAssetPositions", summary = "The asset's positions in a time range, oldest first",
            description = "from and to are ISO-8601 date-times with an offset, from before to, at most 7 days apart "
                    + "(400 otherwise). At most 20000, sampled evenly. Only the signals sent while the asset was the "
                    + "organization's; an empty array when there are none or the asset is not the organization's.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> assetPositions(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId, @QueryParam("from") String from, @QueryParam("to") String to) {
        tenantCode(organizationId);
        return answer(() -> treatments.rangePositions(clientIds(), assetId, from, to));
    }

    /** The client id the symptom list reads as, so the treatment page shows the symptoms the list shows. */
    private List<String> clientIds() {
        return tenantContext.getClientId() == null ? List.of() : List.of(tenantContext.getClientId());
    }

    /** A negative symptom id is one of the evaluator's cases ({@link EngineCase#symptomId()}). */
    private static boolean engineCase(String symptomId) {
        return symptomId != null && symptomId.trim().matches("-\\d{1,18}");
    }

    private static Uni<JsonNode> blocking(Supplier<JsonNode> read) {
        return Uni.createFrom().item(read).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private static Uni<Response> answer(Supplier<Uni<JsonNode>> read) {
        Uni<JsonNode> data;
        try {
            data = read.get();
        } catch (IllegalArgumentException e) {
            return Uni.createFrom().item(error(Response.Status.BAD_REQUEST, e.getMessage()));
        }
        return data.map(body -> Response.ok(body).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> error(Response.Status.BAD_REQUEST, e.getMessage()))
                .onFailure(NoSuchElementException.class)
                .recoverWithItem(e -> error(Response.Status.NOT_FOUND, e.getMessage()))
                .onFailure(ControlTowerMapService.UnavailableException.class)
                .recoverWithItem(e -> error(Response.Status.SERVICE_UNAVAILABLE, e.getMessage()));
    }
}
