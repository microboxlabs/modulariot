package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.service.Auth0ClientDirectoryService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Objects;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Auth0 machine-to-machine clients an org may configure a credential against —
 * the directory behind the client-id autocomplete on the credential form.
 *
 * <p>Owner-gated for the same reason {@link OrgCredentialProfilesResource} is:
 * the response is a map of the organization's identity surface, which is not
 * something every member needs. It answers identifiers and labels only, never a
 * secret, so a leak of this payload does not let anyone act as a client.
 *
 * <p>The path deliberately sits under {@code /integrations/auth0}, clear of the
 * {@code @M2MAuth} control-plane prefixes: {@link com.microboxlabs.miot.core.auth.DualJwtAuthMechanism}
 * routes by resource {@code @Path} with prefix semantics, so a path under one of
 * those would be verified as HS256 and reject the web token this endpoint
 * expects.
 */
@Path("/api/v1/orgs/{organizationId}/integrations/auth0/clients")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Auth0 clients", description = "M2M applications selectable when configuring a credential")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgAuth0ClientsResource {

    private static final int DEFAULT_LIMIT = 20;

    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final Auth0ClientDirectoryService service;

    @Inject
    public OrgAuth0ClientsResource(
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            Auth0ClientDirectoryService service) {
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.service = service;
    }

    /**
     * @param query optional case-insensitive filter over name and client id
     * @param limit page size, clamped to {@link Auth0ClientDirectoryService#MAX_LIMIT}
     */
    @GET
    @Operation(summary = "List the M2M clients this organization may use")
    public Uni<Response> list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("q") String query,
            @QueryParam("limit") @DefaultValue("" + DEFAULT_LIMIT) int limit) {
        requireMatchingOrg(organizationId);
        return roleService.requireOwner(organizationId)
                .flatMap(ignored -> service.list(organizationId, query, limit))
                .map(clients -> Response.ok(Map.of(
                        "data", clients,
                        // Lets the form say the directory half is absent rather than
                        // implying the org's own client is all that exists.
                        "directoryEnabled", service.isDirectoryEnabled())).build());
    }

    private void requireMatchingOrg(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(Map.of("error", "Organization context does not match request path"))
                    .build());
        }
    }
}
