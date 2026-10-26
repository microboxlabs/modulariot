package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.iam.TeamsService;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.MonitorViews;
import com.microboxlabs.miot.trips.service.ConfirmerService;
import com.microboxlabs.miot.trips.service.MonitorService;
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
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Trip monitors: versioned rules that say which event moves which stage of a trip. A draft is edited, checked and
 * published as a new version; trips keep the version they were created with.
 */
@Path("/api/v1/orgs/{organizationId}/trips/monitors")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Monitors", description = "Versioned transition rules for each class of trip")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgMonitorsResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String KEY = "monitorKey";

    private final MonitorService monitors;
    private final ConfirmerService confirmers;
    private final TeamsService teams;

    @Inject
    public OrgMonitorsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            MonitorService monitors,
            ConfirmerService confirmers,
            TeamsService teams) {
        super(tenantContext, organizationContext, roleService, identity);
        this.monitors = monitors;
        this.confirmers = confirmers;
        this.teams = teams;
    }

    @GET
    @Operation(operationId = "listMonitors", summary = "The organization's monitors with their published and draft versions")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(monitors.list(tenant)).build());
    }

    @POST
    @Path("/schema")
    @Operation(operationId = "monitorSchema",
            summary = "The fields an expression may read for a trigger (on), with the given parameters")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> schema(@PathParam(ORG) String organizationId, MonitorViews.CheckRequest body) {
        tenantCode(organizationId);
        return work(() -> Response.ok(monitors.schema(body == null ? null : body.on(),
                body == null ? null : body.params())).build());
    }

    @POST
    @Path("/check")
    @Operation(operationId = "checkMonitorExpression",
            summary = "Checks one expression: a condition (expect=condition) or a timer's time (expect=time)")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> check(@PathParam(ORG) String organizationId, MonitorViews.CheckRequest body) {
        tenantCode(organizationId);
        return work(() -> Response.ok(monitors.check(body)).build());
    }

    @GET
    @Path("/scope-values")
    @Operation(operationId = "monitorScopeValues",
            summary = "The feeds, order types and locations a monitor's scope can name")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> scopeValues(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(monitors.scopeValues(tenant)).build());
    }

    @POST
    @Path("/{monitorKey}/scope-check")
    @Operation(operationId = "checkMonitorScope",
            summary = "How a scope stands to the other published monitors: disjoint ones are left out; a duplicate"
                    + " blocks publishing; of two nested scopes, the narrower one takes the trips in both")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> checkScope(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey,
            MonitorViews.ScopeCheckRequest body) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(monitors.checkScope(tenant, monitorKey, body)).build());
    }

    @GET
    @Path("/{monitorKey}")
    @Operation(operationId = "getMonitor", summary = "A monitor's draft, newest published version and history")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(monitors.get(tenant, monitorKey)).build());
    }

    @PUT
    @Path("/{monitorKey}")
    @Operation(operationId = "saveMonitorDraft",
            summary = "Creates or replaces the draft; problems in its expressions come back as findings")
    @PermissionsAllowed(value = TripsAccessCatalog.MONITOR_ADMIN, permission = OrgPermission.class, params = ORG)
    public Uni<Response> save(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey,
            MonitorRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(monitors.saveDraft(tenant, actor, monitorKey, body)).build());
    }

    @DELETE
    @Path("/{monitorKey}/draft")
    @Operation(operationId = "discardMonitorDraft", summary = "Discards the draft; published versions stay")
    @PermissionsAllowed(value = TripsAccessCatalog.MONITOR_ADMIN, permission = OrgPermission.class, params = ORG)
    public Uni<Response> discard(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            monitors.discardDraft(tenant, actor, monitorKey);
            return Response.noContent().build();
        });
    }

    @GET
    @Path("/{monitorKey}/confirmers")
    @Operation(operationId = "getMonitorConfirmers",
            summary = "The team that confirms each milestone of the monitor's trips: milestone → team id")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> confirmers(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(confirmers.ofMonitor(tenant, monitorKey)).build());
    }

    @PUT
    @Path("/{monitorKey}/confirmers")
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(operationId = "saveMonitorConfirmers",
            summary = "Replaces the teams of the monitor's milestones; a milestone left out is open to the permission")
    @PermissionsAllowed(value = TripsAccessCatalog.MONITOR_ADMIN, permission = OrgPermission.class, params = ORG)
    public Uni<Response> saveConfirmers(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey,
            Map<String, UUID> body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return teams.teams(organizationId)
                .map(all -> all.stream().map(TeamsService.TeamView::id).collect(Collectors.toSet()))
                .flatMap(orgTeams -> work(() -> Response.ok(
                        confirmers.save(tenant, actor, monitorKey, body, orgTeams)).build()));
    }

    @POST
    @Path("/{monitorKey}/publish")
    @Operation(operationId = "publishMonitor",
            summary = "Publishes the draft as a new version (400 while it has findings); new trips use it")
    @PermissionsAllowed(value = TripsAccessCatalog.MONITOR_ADMIN, permission = OrgPermission.class, params = ORG)
    public Uni<Response> publish(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(monitors.publish(tenant, actor, monitorKey)).build());
    }

    @GET
    @Path("/{monitorKey}/versions/{version}")
    @Operation(operationId = "getMonitorVersion", summary = "One version of a monitor")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> version(@PathParam(ORG) String organizationId, @PathParam(KEY) String monitorKey,
            @PathParam("version") int version) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(monitors.version(tenant, monitorKey, version)).build());
    }
}
