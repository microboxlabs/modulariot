package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.auth0.Auth0Management;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The Auth0 M2M applications, each with the top-level organization that uses its client id. Platform owners use it
 * to create organizations for applications that have none. 409 when Auth0 management is not configured.
 */
@Path("/api/v1/platform/auth0-clients")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Organizations")
@SecurityRequirement(name = "oidc")
public class PlatformAuth0ClientsResource {

    /** {@code organization} is the slug of the top-level organization using the client id, or null. */
    public record Auth0ClientView(String clientId, String name, String organization) {
    }

    private final PlatformAuthorizer authorizer;
    private final Auth0Management auth0;

    @Inject
    public PlatformAuth0ClientsResource(PlatformAuthorizer authorizer, Auth0Management auth0) {
        this.authorizer = authorizer;
        this.auth0 = auth0;
    }

    @GET
    @Operation(summary = "List the Auth0 M2M applications and the organization using each")
    public Uni<Response> list() {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(() -> auth0.m2mClients()
                .flatMap(clients -> Panache.withSession(Organization::listAllActiveWithParent)
                        .map(organizations -> views(clients, organizations)))));
    }

    static List<Auth0ClientView> views(List<Auth0Management.M2mClient> clients, List<Organization> organizations) {
        Map<String, String> owners = new HashMap<>();
        organizations.stream()
                .filter(org -> org.parent == null && org.tenantClientId != null)
                .forEach(org -> owners.putIfAbsent(org.tenantClientId, org.slug));
        return clients.stream()
                .map(client -> new Auth0ClientView(client.clientId(), client.name(), owners.get(client.clientId())))
                .toList();
    }
}
