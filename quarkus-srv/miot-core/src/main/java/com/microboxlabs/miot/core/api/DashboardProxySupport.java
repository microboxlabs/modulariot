package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * What every proxy to the dashboard server shares: the org's address in the
 * upstream's tenant and scope model, the membership assertion, and passing
 * the upstream answer through unchanged.
 */
@ApplicationScoped
public class DashboardProxySupport {

    /** Alfresco's site groups are named for the site they belong to. */
    private static final String SITE_GROUP_PREFIX = "GROUP_site_";

    private final OrganizationContext organizationContext;
    private final String defaultScopeId;
    private final String proxyKey;

    @Inject
    public DashboardProxySupport(OrganizationContext organizationContext,
                                 @ConfigProperty(name = "miot.dashboards.default-scope",
                                         defaultValue = "default")
                                 String defaultScopeId,
                                 @ConfigProperty(name = "miot.dashboards.proxy-key")
                                 Optional<String> proxyKey) {
        this.organizationContext = organizationContext;
        this.defaultScopeId = defaultScopeId;
        this.proxyKey = proxyKey.filter(key -> !key.isBlank()).orElse(null);
    }

    /**
     * The org slug. Not {@code tenantClientId}: that is an OAuth client id and
     * would leak into browser history and logs from the URL.
     */
    String tenantIdFor(String slug) {
        return slug;
    }

    /**
     * The Alfresco site behind the org. An org whose group is not a site
     * group, or that has none, falls back to the configured scope id.
     */
    String scopeIdFor() {
        return scopeIdFrom(organizationContext.getAlfrescoGroupId(), defaultScopeId);
    }

    static String scopeIdFrom(String alfrescoGroupId, String defaultScopeId) {
        if (alfrescoGroupId != null && alfrescoGroupId.startsWith(SITE_GROUP_PREFIX)) {
            String siteId = alfrescoGroupId.substring(SITE_GROUP_PREFIX.length());
            if (!siteId.isBlank()) {
                return siteId;
            }
        }
        return defaultScopeId;
    }

    /**
     * Alfresco's site roles as the dashboard server names them. Anything
     * else, a null included, is {@code Consumer}, the lowest of the four.
     */
    static String dashboardRoleFrom(String alfrescoRole) {
        if (alfrescoRole == null) {
            return "Consumer";
        }
        return switch (alfrescoRole) {
            case "SITE_MANAGER" -> "Coordinator";
            case "SITE_COLLABORATOR" -> "Editor";
            case "SITE_CONTRIBUTOR" -> "Contributor";
            default -> "Consumer";
        };
    }

    /**
     * The membership to assert, or {@link DashboardAssertion#none()} when no
     * key is configured, the caller is not a web user, or there is no bearer
     * token for the upstream to match the asserted user against.
     */
    DashboardAssertion assertionFor(String slug, String authorization) {
        String email = organizationContext.getUserEmail();
        if (proxyKey == null || email == null
                || authorization == null || authorization.isBlank()) {
            return DashboardAssertion.none();
        }
        return new DashboardAssertion(proxyKey, email, tenantIdFor(slug),
                scopeIdFor(), dashboardRoleFrom(organizationContext.getAlfrescoRole()));
    }

    /**
     * Pass the upstream status, body and headers through unchanged. The REST
     * client throws {@link WebApplicationException} for a non-2xx answer;
     * unwrapped so a 401, 403, 404 or 409 reaches the caller rather than
     * becoming a proxy-side 500.
     */
    static Uni<Response> passThrough(Uni<Response> upstream) {
        return upstream
                .onFailure(WebApplicationException.class)
                .recoverWithItem(DashboardProxySupport::unwrapResponse)
                .map(r -> Response.fromResponse(r).build());
    }

    private static Response unwrapResponse(Throwable err) {
        if (err instanceof WebApplicationException wae) {
            return wae.getResponse();
        }
        throw new IllegalStateException("Expected WebApplicationException from upstream", err);
    }
}
