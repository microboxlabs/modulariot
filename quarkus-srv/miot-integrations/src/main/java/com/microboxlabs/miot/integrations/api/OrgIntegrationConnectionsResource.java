package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import java.util.Objects;

@Path("/api/v1/orgs/{organizationId}/integrations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Integration Connections", description = "External API connections, credential profiles, and endpoint operations")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgIntegrationConnectionsResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final IntegrationConnectionService service;

    @Inject
    public OrgIntegrationConnectionsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            IntegrationConnectionService service) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.service = service;
    }

    @GET
    @Path("/credential-profiles")
    @Operation(summary = "List credential profiles")
    public Response listCredentialProfiles(@PathParam("organizationId") String organizationId) {
        return Response.ok(service.listCredentialProfiles(tenantCode(organizationId))).build();
    }

    @POST
    @Path("/credential-profiles")
    @Operation(summary = "Create a credential profile")
    public Response createCredentialProfile(
            @PathParam("organizationId") String organizationId,
            CreateCredentialProfileRequest req) {
        return Response.status(Response.Status.CREATED)
                .entity(service.createCredentialProfile(tenantCode(organizationId), req))
                .build();
    }

    @GET
    @Path("/connections")
    @Operation(summary = "List integration connections")
    public Response listConnections(@PathParam("organizationId") String organizationId) {
        return Response.ok(service.listConnections(tenantCode(organizationId))).build();
    }

    @POST
    @Path("/connections")
    @Operation(summary = "Create an integration connection")
    public Response createConnection(
            @PathParam("organizationId") String organizationId,
            CreateIntegrationConnectionRequest req) {
        return Response.status(Response.Status.CREATED)
                .entity(service.createConnection(tenantCode(organizationId), req))
                .build();
    }

    @GET
    @Path("/connections/{connectionId}")
    @Operation(summary = "Get an integration connection")
    public Response getConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId) {
        var connection = service.getConnection(tenantCode(organizationId), connectionId);
        return connection == null ? Response.status(Response.Status.NOT_FOUND).build() : Response.ok(connection).build();
    }

    @POST
    @Path("/connections/{connectionId}/test")
    @Operation(summary = "Test an integration connection")
    public Response testConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId,
            ConnectionTestRequest req) {
        return Response.ok(service.testConnection(tenantCode(organizationId), connectionId, req)).build();
    }

    @GET
    @Path("/connections/{connectionId}/operations")
    @Operation(summary = "List integration operations")
    public Response listOperations(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId) {
        return Response.ok(service.listOperations(tenantCode(organizationId), connectionId)).build();
    }

    @POST
    @Path("/connections/{connectionId}/operations")
    @Operation(summary = "Create an integration operation")
    public Response createOperation(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId,
            CreateIntegrationOperationRequest req) {
        var operation = service.addOperation(tenantCode(organizationId), connectionId, req);
        return operation == null
                ? Response.status(Response.Status.NOT_FOUND).build()
                : Response.status(Response.Status.CREATED).entity(operation).build();
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .type(MediaType.APPLICATION_JSON)
                    .entity("{\"error\":\"Organization context does not match request path\"}")
                    .build());
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }
}
