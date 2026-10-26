package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.TeamsService;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.service.ConfirmerService;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.MilestoneService.DetectionRef;
import com.microboxlabs.miot.trips.service.TripService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Departure, arrival and closure of a trip: what was detected and what a person confirmed. */
@Path("/api/v1/orgs/{organizationId}/trips")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Milestones",
        description = "Presentation, validation, departure, arrival and closure, detected by systems and confirmed")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripMilestonesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String ID = "id";
    private static final String MILESTONE = "milestone";

    public record DetectionRequest(OffsetDateTime proposedAt, String source) {
    }

    /**
     * {@code at} defaults to the time the pending detection proposed, else now. {@code channel} is {@code ui} or
     * {@code api} (the default). {@code evidence} is metadata kept with the milestone.
     */
    public record ConfirmRequest(OffsetDateTime at, String channel, String note, DetectionRequest expectedDetection,
            Map<String, Object> evidence) {
    }

    /** A system saw the milestone: {@code source} names it ({@code gate}, {@code wms}…), {@code at} defaults to now. */
    public record DetectRequest(OffsetDateTime at, String source, Map<String, Object> evidence) {
    }

    public record RejectRequest(String channel, String note, DetectionRequest expectedDetection) {
    }

    private final MilestoneService milestones;
    private final TripService trips;
    private final ConfirmerService confirmers;
    private final TeamsService teams;

    @Inject
    public OrgTripMilestonesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            MilestoneService milestones,
            TripService trips,
            ConfirmerService confirmers,
            TeamsService teams) {
        super(tenantContext, organizationContext, roleService, identity);
        this.milestones = milestones;
        this.trips = trips;
        this.confirmers = confirmers;
        this.teams = teams;
    }

    @GET
    @Path("/milestones/pending")
    @Operation(operationId = "listPendingMilestones",
            summary = "The organization's departures, arrivals and closures waiting for a person, oldest first")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> pending(@PathParam(ORG) String organizationId, @QueryParam("limit") Integer limit) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(milestones.pending(tenant, limit)).build());
    }

    @GET
    @Path("/{id}/milestones")
    @Operation(operationId = "listTripMilestones",
            summary = "The trip's departure, arrival and closure: open, pending a confirmation, confirmed or rejected")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(milestones.list(tenant, trip(tenant, id))).build());
    }

    @POST
    @Path("/{id}/milestones/{milestone}/confirm")
    @Operation(operationId = "confirmTripMilestone",
            summary = "Confirms a milestone; the trip's monitor gets <milestone>_confirmed at the confirmed time")
    @PermissionsAllowed(value = TripsAccessCatalog.MILESTONE_CONFIRM, permission = OrgPermission.class,
            params = ORG)
    public Uni<Response> confirm(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(MILESTONE) String milestone, ConfirmRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return callerTeams(organizationId)
                .flatMap(mine -> work(() -> confirmForCaller(tenant, actor, id, milestone, body, mine)));
    }

    private Response confirmForCaller(String tenant, String actor, String id, String milestone,
            ConfirmRequest body, Set<UUID> mine) {
        UUID tripId = trip(tenant, id);
        confirmers.require(tenant, tripId, milestone, mine);
        String ch = channel(body == null ? null : body.channel());
        if (body != null && body.expectedDetection() != null) {
            if (body.at() != null) {
                throw new IllegalArgumentException("at cannot be combined with expectedDetection");
            }
            DetectionRequest expected = body.expectedDetection();
            return Response.ok(milestones.respondToDetection(tenant, actor, tripId,
                    new DetectionRef(milestone, expected.proposedAt(), expected.source()), true, ch,
                    body.note())).build();
        }
        return Response.ok(milestones.confirm(tenant, actor, tripId, milestone,
                body == null ? null : body.at(), ch, body == null ? null : body.note(),
                body == null ? null : body.evidence())).build();
    }

    @POST
    @Path("/{id}/milestones/{milestone}/detect")
    @Operation(operationId = "detectTripMilestone",
            summary = "A system reports a milestone with its metadata; it waits for a confirmation")
    @PermissionsAllowed(value = TripsAccessCatalog.MILESTONE_CONFIRM, permission = OrgPermission.class,
            params = ORG)
    public Uni<Response> detect(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(MILESTONE) String milestone, DetectRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            UUID tripId = trip(tenant, id);
            return Response.ok(body == null ? milestones.detect(tenant, actor, tripId, milestone, null, null, null)
                    : milestones.detect(tenant, actor, tripId, milestone, body.source(), body.at(),
                            body.evidence())).build();
        });
    }

    @POST
    @Path("/{id}/milestones/{milestone}/reject")
    @Operation(operationId = "rejectTripMilestone",
            summary = "Rejects the pending detection of a milestone as a false positive; the next one asks again")
    @PermissionsAllowed(value = TripsAccessCatalog.MILESTONE_CONFIRM, permission = OrgPermission.class,
            params = ORG)
    public Uni<Response> reject(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(MILESTONE) String milestone, RejectRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return callerTeams(organizationId).flatMap(mine -> work(() -> {
            UUID tripId = trip(tenant, id);
            confirmers.require(tenant, tripId, milestone, mine);
            String ch = channel(body == null ? null : body.channel());
            if (body != null && body.expectedDetection() != null) {
                DetectionRequest expected = body.expectedDetection();
                return Response.ok(milestones.respondToDetection(tenant, actor, tripId,
                        new DetectionRef(milestone, expected.proposedAt(), expected.source()), false, ch,
                        body.note())).build();
            }
            return Response.ok(milestones.reject(tenant, actor, tripId, milestone,
                    ch, body == null ? null : body.note())).build();
        }));
    }

    /** People confirm through the UI or the API; the feed and notice replies have their own paths. */
    private static String channel(String channel) {
        if (channel == null || channel.isBlank()) {
            return "api";
        }
        if (!"ui".equals(channel) && !"api".equals(channel)) {
            throw new IllegalArgumentException("channel must be ui or api");
        }
        return channel;
    }

    /** The caller's teams in the organization; null when the caller is not a person. */
    private Uni<Set<UUID>> callerTeams(String organizationId) {
        Caller caller = caller();
        if (!caller.isUser()) {
            return Uni.createFrom().nullItem();
        }
        return teams.teamsOf(organizationId, caller)
                .map(refs -> refs.stream().map(TeamsService.TeamRef::id).collect(Collectors.toSet()));
    }

    private UUID trip(String tenant, String id) {
        UUID tripId = uuid(id, ID);
        trips.get(tenant, tripId);
        return tripId;
    }
}
