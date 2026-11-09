package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseService;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.map.ControlTowerMapService;
import com.microboxlabs.miot.symptoms.map.ControlTowerTreatmentService;
import com.microboxlabs.miot.symptoms.map.TripWindows;
import com.microboxlabs.miot.symptoms.service.TreatmentService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.enterprise.inject.Instance;
import com.microboxlabs.miot.core.trips.TripGeofences;
import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.symptoms.map.SignalStateFields;
import java.time.Clock;
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
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The map, the dashboard counters and the treatment page, read from the GPS database as the organization. Answers
 * 404 for a symptom or trip outside the organization, and 503 when the GPS data cannot be read.
 *
 * <p>With {@code miot.symptoms.legacy.enabled=false} the symptoms are the evaluator's cases only: the list, the
 * counters and the summary read no GPS database symptoms, the positions carry each vehicle's level from its open
 * cases, and a GPS database symptom (positive id) is 404.
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
    private final TreatmentService caseTreatments;
    private final TripWindows tripWindows;
    private final Instance<TripGeofences> tripGeofences;
    private final boolean legacy;
    private final Instance<SignalStates> signals;
    private final Clock clock;

    @Inject
    public OrgControlTowerMapResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            ControlTowerMapService map,
            ControlTowerTreatmentService treatments,
            EngineCaseService cases,
            TreatmentService caseTreatments,
            TripWindows tripWindows,
            Instance<TripGeofences> tripGeofences,
            Instance<SignalStates> signals,
            @ConfigProperty(name = "miot.symptoms.legacy.enabled", defaultValue = "true") boolean legacy) {
        this(tenantContext, organizationContext, roleService, identity,
                new MapServices(map, treatments, cases, caseTreatments, tripWindows, tripGeofences, signals),
                Clock.systemUTC(), legacy);
    }

    record MapServices(ControlTowerMapService map, ControlTowerTreatmentService treatments,
            EngineCaseService cases, TreatmentService caseTreatments, TripWindows tripWindows,
            Instance<TripGeofences> tripGeofences, Instance<SignalStates> signals) {
    }

    OrgControlTowerMapResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            MapServices services,
            Clock clock, boolean legacy) {
        super(tenantContext, organizationContext, roleService, identity);
        this.tenantContext = tenantContext;
        this.map = services.map();
        this.treatments = services.treatments();
        this.cases = services.cases();
        this.caseTreatments = services.caseTreatments();
        this.tripWindows = services.tripWindows();
        this.tripGeofences = services.tripGeofences();
        this.legacy = legacy;
        this.signals = services.signals();
        this.clock = clock;
    }

    @GET
    @Path("/positions")
    @Operation(operationId = "listMapPositions", summary = "Last position of each of the organization's assets",
            description = "Each position has signal: the lost-signal detector's state of its asset (state online, "
                    + "offline or unknown; offline_since, last_frame_at, silence_s, expected_s when known).")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> positions(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return answer(() -> map.positions(tenantContext.getClientId())
                .emitOn(Infrastructure.getDefaultWorkerPool())
                .map(p -> SignalStateFields.withSignal(p, signalStates(), clock.instant()))
                .map(p -> legacy ? p : cases.withCaseLevels(tenant, p)));
    }

    @GET
    @Path("/assets/{assetId}/signal")
    @Operation(operationId = "getMapAssetSignal", summary = "Whether the asset's GPS signal is arriving",
            description = "The lost-signal detector's state: offline once the time since the newest frame arrived "
                    + "passes the silence expected for the vehicle. state online, offline or unknown (no profile); "
                    + "offline_since (the newest frame's GPS time, when offline), last_frame_at, silence_s and "
                    + "expected_s when known. 404 when the asset is not among the organization's positions.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> assetSignal(@PathParam("organizationId") String organizationId,
            @PathParam("assetId") String assetId) {
        tenantCode(organizationId);
        return answer(() -> map.positions(tenantContext.getClientId())
                .emitOn(Infrastructure.getDefaultWorkerPool())
                .map(p -> SignalStateFields.one(p, assetId, signalStates(), clock.instant())));
    }

    private SignalStates signalStates() {
        return signals.isResolvable() ? signals.get() : null;
    }

    @GET
    @Path("/summary")
    @Operation(operationId = "getMapSummary", summary = "Service, fleet and symptom totals shown beside the map")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> summary(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        if (!legacy) {
            return answer(() -> blocking(() -> cases.summary(tenant)));
        }
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
        if (!legacy) {
            return answer(() -> blocking(() -> cases.caseCounts(tenant, from, to)));
        }
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
        String tenant = tenantCode(organizationId);
        Map<String, String> filters = new LinkedHashMap<>();
        uri.getQueryParameters().forEach((name, values) -> filters.put(name, values.isEmpty() ? null : values.get(0)));
        if (!legacy) {
            return answer(() -> {
                Map<String, String> checked = ControlTowerMapService.symptomFilters(filters);
                return blocking(() -> cases.casesPage(tenant, checked));
            });
        }
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
            long id = Long.parseLong(symptomId.trim());
            return answer(() -> blocking(() -> EngineCaseService.withTreatments(cases.header(tenant, id),
                    caseTreatments.listForSymptom(tenant, id))));
        }
        if (!legacy) {
            return notFound();
        }
        return answer(() -> treatments.treatment(clientIds(), symptomId));
    }

    @GET
    @Path("/symptoms/{symptomId}/context")
    @Operation(operationId = "getMapSymptomContext", summary = "What an operator step's script reads for a case",
            description = "case, condition, trip and vehicle of an engine case (negative id); a script writes them "
                    + "as {{trip.driver.name}}. 404 for other cases and for cases not the organization's.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> symptomContext(@PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId) {
        String tenant = tenantCode(organizationId);
        if (!engineCase(symptomId)) {
            return notFound();
        }
        long id = Long.parseLong(symptomId.trim());
        return answer(() -> blocking(() -> cases.context(tenant, id)));
    }

    @GET
    @Path("/symptoms/{symptomId}/timeline")
    @Operation(operationId = "getMapSymptomTimeline", summary = "An engine case's life as one ordered list",
            description = "OPENED, LEVEL_CHANGED, NOTED, HELD, ACTION and CLOSED entries with their time, for the "
                    + "response editor's timeline preview. 404 for other cases and for cases not the organization's.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> symptomTimeline(@PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId) {
        String tenant = tenantCode(organizationId);
        if (!engineCase(symptomId)) {
            return notFound();
        }
        long id = Long.parseLong(symptomId.trim());
        return answer(() -> blocking(() -> cases.timeline(tenant, id, caseTreatments.listForSymptom(tenant, id))));
    }

    @GET
    @Path("/script-samples")
    @Operation(operationId = "getScriptSamples", summary = "Recent cases of a symptom, to write a script with",
            description = "Up to 10 of the symptom's newest engine cases, those at level first, each with the "
                    + "context a script reads (see getMapSymptomContext). 400 without symptom.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> scriptSamples(@PathParam("organizationId") String organizationId,
            @QueryParam("symptom") String symptom, @QueryParam("level") Integer level) {
        String tenant = tenantCode(organizationId);
        return answer(() -> blocking(() -> cases.scriptSamples(tenant, symptom, level)));
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
        if (!legacy) {
            return notFound();
        }
        return answer(() -> treatments.signals(clientIds(), symptomId));
    }

    @GET
    @Path("/symptoms/{symptomId}/positions")
    @Operation(operationId = "listMapSymptomPositions",
            summary = "The vehicle's positions around one of the evaluator's cases",
            description = "From an hour before the case opened, or from the vehicle's previous case when nearer, until "
                    + "the case closed or now; a case on a trips-module trip reads the whole trip, as the trip's "
                    + "positions do. Oldest first, at most 20000, sampled evenly. Only for the evaluator's cases "
                    + "(negative ids): a GPS database symptom with a trip reads the trip's positions. 404 when the case is not the "
                    + "organization's. Each position has received_at, when it reached the platform, and delay_s, "
                    + "the seconds after its GPS time (null without an arrival time).")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> symptomPositions(@PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId) {
        String tenant = tenantCode(organizationId);
        if (!engineCase(symptomId) && !legacy) {
            return notFound();
        }
        if (!engineCase(symptomId)) {
            return Uni.createFrom().item(error(Response.Status.BAD_REQUEST,
                    "Only the evaluator's cases have positions here; read the trip's"));
        }
        long id = Long.parseLong(symptomId.trim());
        return answer(() -> Uni.createFrom().item(() -> cases.signalWindow(tenant, id))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .flatMap(w -> w.onTrip()
                        ? treatments.tripAssetPositions(clientIds(), w.assetId(), w.from(), w.to())
                        : treatments.assetPositions(clientIds(), w.assetId(), w.from(), w.to())));
    }

    @GET
    @Path("/trips/{tripId}/geofences")
    @Operation(operationId = "listMapTripGeofences", summary = "The owning engine's trip geofences")
    @PermissionsAllowed(value = {ControlTowerAccessCatalog.VIEW, "trips:view"}, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> tripGeofences(@PathParam("organizationId") String organizationId,
            @PathParam("tripId") String tripId) {
        String tenant = tenantCode(organizationId);
        var moduleTrip = TripWindows.tripsModuleId(tripId);
        if (moduleTrip.isEmpty()) {
            return access(organizationId).flatMap(access -> access.can(ControlTowerAccessCatalog.VIEW)
                    ? answer(() -> treatments.tripGeofences(clientIds(), tripId))
                    : Uni.createFrom().item(error(Response.Status.FORBIDDEN, "Control Tower view permission required")));
        }
        return answer(() -> Uni.createFrom().item(() -> tripGeofences.isUnsatisfied()
                ? (JsonNode) JsonNodeFactory.instance.arrayNode()
                : tripGeofences.get().geofences(tenant, moduleTrip.get()))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool()));
    }

    @GET
    @Path("/trips/{tripId}/positions")
    @Operation(operationId = "listMapTripPositions", summary = "The asset's positions during a trip, oldest first",
            description = "At most 20000, sampled evenly over the trip. A UUID is a trips-module trip: the truck's "
                    + "positions from its departure until it ended or now; of a longer trip, its last 7 days; none "
                    + "before it departs. "
                    + "Any other id is a GPS database trip. 404 when the trip does not exist for the asset or the "
                    + "asset was not the organization's when the trip started. Each position has received_at and "
                    + "delay_s, as the symptom's positions.")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> tripPositions(@PathParam("organizationId") String organizationId,
            @PathParam("tripId") String tripId, @QueryParam("assetId") String assetId) {
        String tenant = tenantCode(organizationId);
        var moduleTrip = TripWindows.tripsModuleId(tripId);
        if (moduleTrip.isEmpty()) {
            return answer(() -> treatments.tripPositions(clientIds(), tripId, assetId));
        }
        return answer(() -> Uni.createFrom().item(() -> tripWindows.find(tenant, moduleTrip.get(), assetId)
                        .orElseThrow(() -> new NoSuchElementException("Trip not found")))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .flatMap(w -> w.from() == null
                        ? Uni.createFrom().item((JsonNode) JsonNodeFactory.instance.arrayNode())
                        : treatments.tripAssetPositions(clientIds(), assetId.trim(), w.from(), w.to())));
    }

    @GET
    @Path("/assets/{assetId}/positions")
    @Operation(operationId = "listMapAssetPositions", summary = "The asset's positions in a time range, oldest first",
            description = "from and to are ISO-8601 date-times with an offset, from before to, at most 7 days apart "
                    + "(400 otherwise). At most 20000, sampled evenly. Only the signals sent while the asset was the "
                    + "organization's; an empty array when there are none or the asset is not the organization's. "
                    + "Each position has received_at and delay_s, as the symptom's positions.")
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

    /** A GPS database symptom while this installation shows the evaluator's cases only. */
    private static Uni<Response> notFound() {
        return Uni.createFrom().item(error(Response.Status.NOT_FOUND, "Symptom not found"));
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
