package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
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

    @Inject
    public OrgDataSourcesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            DataSourceService sources) {
        super(tenantContext, organizationContext, roleService, identity);
        this.sources = sources;
    }

    @GET
    @Operation(operationId = "listDataSources", summary = "Data sources: the platform's and the organization's")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(sources.list(tenant)).build());
    }

    @GET
    @Path("/{key}")
    @Operation(operationId = "getDataSource",
            summary = "A data source with its fields and samples (recent engine values for the GPS signal)")
    public Uni<Response> get(@PathParam("organizationId") String organizationId, @PathParam("key") String key) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(sources.get(tenant, key)).build());
    }
}
