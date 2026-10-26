package com.microboxlabs.miot.trips.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.dto.FeedBatchRequest;
import com.microboxlabs.miot.trips.dto.FeedProfileRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceView;
import com.microboxlabs.miot.trips.service.FeedBatchService;
import com.microboxlabs.miot.trips.service.FeedProfileService;
import com.microboxlabs.miot.trips.service.FeedReconciler;
import com.microboxlabs.miot.trips.store.FeedStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.NoSuchElementException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Trip feeds: an external source sends the desired state of its services and the module reconciles each one. A
 * batch queues one async job per changed service; a single service can also be reconciled at once, or as a dry run.
 */
@Path("/api/v1/orgs/{organizationId}/trips/feeds")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Feeds", description = "Desired state of external services, reconciled into mandates and trips")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgFeedsResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String FEED = "feedKey";
    private static final String CODE = "externalCode";

    private final FeedProfileService profiles;
    private final FeedReconciler reconciler;
    private final FeedBatchService batches;
    private final FeedStore feeds;
    private final ObjectMapper json;

    @Inject
    public OrgFeedsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            FeedProfileService profiles,
            FeedReconciler reconciler,
            FeedBatchService batches,
            FeedStore feeds,
            ObjectMapper json) {
        super(tenantContext, organizationContext, roleService, identity);
        this.profiles = profiles;
        this.reconciler = reconciler;
        this.batches = batches;
        this.feeds = feeds;
        this.json = json;
    }

    @GET
    @Operation(operationId = "listFeeds", summary = "The organization's feeds and their rules")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(profiles.views(tenant)).build());
    }

    @PUT
    @Path("/{feedKey}")
    @Operation(operationId = "saveFeed",
            summary = "Creates or replaces a feed's rules: name, stage plan, arrival stage, required resources, active")
    @PermissionsAllowed(value = TripsAccessCatalog.FEED_ADMIN, permission = OrgPermission.class, params = ORG)
    public Uni<Response> save(@PathParam(ORG) String organizationId, @PathParam(FEED) String feedKey,
            FeedProfileRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(profiles.saveView(tenant, actor, feedKey, body)).build());
    }

    @POST
    @Path("/{feedKey}/batches")
    @Operation(operationId = "sendFeedBatch",
            summary = "Queues one async job per service whose desired state changed (202); unchanged ones are skipped")
    @PermissionsAllowed(value = TripsAccessCatalog.FEED_WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> batch(@PathParam(ORG) String organizationId, @PathParam(FEED) String feedKey,
            FeedBatchRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.accepted(batches.send(tenant, actor, feedKey, body)).build());
    }

    @PUT
    @Path("/{feedKey}/services/{externalCode}")
    @Operation(operationId = "reconcileFeedService",
            summary = "Reconciles one service now and returns what was done; with dryRun=true, what would be done")
    @PermissionsAllowed(value = TripsAccessCatalog.FEED_WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> reconcile(@PathParam(ORG) String organizationId, @PathParam(FEED) String feedKey,
            @PathParam(CODE) String externalCode, @QueryParam("dryRun") boolean dryRun, FeedServiceRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(reconciler.reconcile(tenant, actor, feedKey, externalCode, body, dryRun))
                .build());
    }

    @GET
    @Path("/{feedKey}/services/{externalCode}")
    @Operation(operationId = "getFeedService", summary = "A service's latest desired state and last outcome")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam(FEED) String feedKey,
            @PathParam(CODE) String externalCode) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            FeedService s = feeds.service(tenant, feedKey, externalCode)
                    .orElseThrow(() -> new NoSuchElementException("feed service not found"));
            return Response.ok(new FeedServiceView(s.externalCode(), node(s.desired()), s.mandateId(), s.tripId(),
                    s.open(), s.lastAction(), node(s.lastResult()), s.lastReconciledAt())).build();
        });
    }

    private JsonNode node(String text) {
        try {
            return text == null ? null : json.readTree(text);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("stored JSON is not readable", e);
        }
    }
}
