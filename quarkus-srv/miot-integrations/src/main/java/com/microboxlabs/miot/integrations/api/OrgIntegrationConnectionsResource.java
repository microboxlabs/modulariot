package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1/orgs/{organizationId}/integrations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Integration Connections", description = "External API connections, credential profiles, and endpoint operations")
@SecurityRequirement(name = "oidc")
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgIntegrationConnectionsResource {

    private final TenantContext tenantContext;
    private final IntegrationConnectionService service;

    @Inject
    public OrgIntegrationConnectionsResource(TenantContext tenantContext, IntegrationConnectionService service) {
        this.tenantContext = tenantContext;
        this.service = service;
    }

    @GET
    @Path("/credential-profiles")
    @Operation(summary = "List credential profiles")
    public Response listCredentialProfiles(@PathParam("organizationId") String organizationId) {
        return Response.ok(service.listCredentialProfiles(tenantCode())).build();
    }

    @POST
    @Path("/credential-profiles")
    @Operation(summary = "Create a credential profile")
    public Response createCredentialProfile(
            @PathParam("organizationId") String organizationId,
            CreateCredentialProfileRequest req) {
        return Response.status(Response.Status.CREATED)
                .entity(service.createCredentialProfile(tenantCode(), req))
                .build();
    }

    @GET
    @Path("/connections")
    @Operation(summary = "List integration connections")
    public Response listConnections(@PathParam("organizationId") String organizationId) {
        return Response.ok(service.listConnections(tenantCode())).build();
    }

    @POST
    @Path("/connections")
    @Operation(summary = "Create an integration connection")
    public Response createConnection(
            @PathParam("organizationId") String organizationId,
            CreateIntegrationConnectionRequest req) {
        return Response.status(Response.Status.CREATED)
                .entity(service.createConnection(tenantCode(), req))
                .build();
    }

    @GET
    @Path("/connections/{connectionId}")
    @Operation(summary = "Get an integration connection")
    public Response getConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId) {
        var connection = service.getConnection(tenantCode(), connectionId);
        return connection == null ? Response.status(Response.Status.NOT_FOUND).build() : Response.ok(connection).build();
    }

    @POST
    @Path("/connections/{connectionId}/test")
    @Operation(summary = "Test an integration connection")
    public Response testConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId,
            ConnectionTestRequest req) {
        return Response.ok(service.testConnection(tenantCode(), connectionId, req)).build();
    }

    @GET
    @Path("/connections/{connectionId}/operations")
    @Operation(summary = "List integration operations")
    public Response listOperations(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId) {
        return Response.ok(service.listOperations(tenantCode(), connectionId)).build();
    }

    @POST
    @Path("/connections/{connectionId}/operations")
    @Operation(summary = "Create an integration operation")
    public Response createOperation(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId,
            CreateIntegrationOperationRequest req) {
        var operation = service.addOperation(tenantCode(), connectionId, req);
        return operation == null
                ? Response.status(Response.Status.NOT_FOUND).build()
                : Response.status(Response.Status.CREATED).entity(operation).build();
    }

    private String tenantCode() {
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }
}
