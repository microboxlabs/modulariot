package com.microboxlabs.miot.core.mcp;

import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Lets the caller of an MCP request into the organization a tool names. The
 * MCP endpoint has no organization in its path, so the REST filter does not
 * run for it: each tool takes the organization's slug and calls this, which
 * applies the same membership rules.
 */
@ApplicationScoped
public class McpCaller {

    /** The organization's tenant, and who is acting in it. */
    public record Entered(String tenantCode, String actor) {
    }

    private final SecurityIdentity identity;
    private final OrganizationAccess access;
    private final OrganizationRoleService roles;
    private final TenantContext tenantContext;
    private final List<String> clientIdClaims;

    @Inject
    public McpCaller(
            SecurityIdentity identity,
            OrganizationAccess access,
            OrganizationRoleService roles,
            TenantContext tenantContext,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp") List<String> clientIdClaims) {
        this.identity = identity;
        this.access = access;
        this.roles = roles;
        this.tenantContext = tenantContext;
        this.clientIdClaims = clientIdClaims;
    }

    /** Any member of the organization. */
    public Uni<Entered> member(String organization) {
        if (organization == null || organization.isBlank()) {
            return Uni.createFrom().failure(new ToolCallException("organization is required"));
        }
        String email = OrganizationAccess.email(identity);
        return access.enter(organization, email, OrganizationAccess.clientId(identity, clientIdClaims))
                .map(refusal -> {
                    if (refusal != null) {
                        throw new ToolCallException(refusal.message());
                    }
                    return new Entered(tenantContext.getTenantCode(), actor(email));
                });
    }

    /** An owner of the organization, as the REST writes require. */
    public Uni<Entered> owner(String organization) {
        return member(organization).flatMap(entered -> roles.requireOwner(organization)
                .onFailure(WebApplicationException.class)
                .transform(e -> new ToolCallException(e.getMessage()))
                .replaceWith(entered));
    }

    /** The user's email for a session token, the client id for an M2M token. */
    private String actor(String email) {
        if (email != null) {
            return email;
        }
        return identity != null && identity.getPrincipal() != null ? identity.getPrincipal().getName() : null;
    }
}
