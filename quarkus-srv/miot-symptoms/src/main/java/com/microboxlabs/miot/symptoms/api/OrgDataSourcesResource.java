package com.microboxlabs.miot.symptoms.api;

import io.quarkus.security.PermissionsAllowed;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.signal.EventTypes;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The data sources symptom rules can read, with each field's type, unit and origin. */
@Path("/api/v1/orgs/{organizationId}/control-tower/data-sources")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Data sources", description = "What symptom rules can read, and recent samples")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgDataSourcesResource extends ControlTowerResourceSupport {

    private final DataSourceService sources;
    private final SignalSamples samples;

    @Inject
    public OrgDataSourcesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            DataSourceService sources,
            SignalSamples samples) {
        super(tenantContext, organizationContext, roleService, identity);
        this.sources = sources;
        this.samples = samples;
    }

    @GET
    @Operation(operationId = "listDataSources", summary = "Data sources: the platform's and the organization's")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(sources.list(tenant)).build());
    }

    @GET
    @Path("/{key}")
    @Operation(operationId = "getDataSource",
            summary = "A data source with its fields and samples (recent engine values for the GPS signal)")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> get(@PathParam("organizationId") String organizationId, @PathParam("key") String key) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(sources.get(tenant, key)).build());
    }

    @GET
    @Path("/gps_signal/event-types")
    @Operation(operationId = "listGpsEventTypes",
            summary = "The event types (signal.frame.events[].event_type) the organization's frames carried in the"
                    + " last days, with how many frames carried each, most frequent first")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> eventTypes(@PathParam("organizationId") String organizationId,
            @QueryParam("days") @DefaultValue("7") int days) {
        String tenant = tenantCode(organizationId);
        int bounded = Math.clamp(days, 1, EventTypes.MAX_DAYS);
        return work(() -> Response.ok(Map.of("days", bounded, "types", samples.eventTypes(tenant, bounded)))
                .build());
    }
}
