package com.microboxlabs.miot.core.auth;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Authorizes platform-scope writes — the ones that are not about a single
 * organization, such as per-domain branding.
 *
 * <p>{@link WriteAuthorizer} cannot express this: its rule is "SITE_MANAGER on
 * the parent org", and a domain belongs to no org. Nor can
 * {@link OrganizationRequestFilter} help, since it only intercepts
 * {@code /api/v1/orgs/**} and so leaves {@link OrganizationContext} empty here.
 *
 * <p>The owner list comes from {@code miot.platform.owner-emails} and is empty
 * by default, which denies every write. Keeping it in configuration rather than
 * a table means there is no role-management UI to build; this class is the seam
 * to replace if that changes.
 */
@ApplicationScoped
public class PlatformAuthorizer {

    private final Set<String> ownerEmails;
    private final boolean allowDevUserHeader;
    private final SecurityIdentity securityIdentity;

    @Inject
    public PlatformAuthorizer(
            @ConfigProperty(name = "miot.platform.owner-emails", defaultValue = "")
            List<String> ownerEmails,
            @ConfigProperty(name = "miot.platform.allow-dev-user-header", defaultValue = "false")
            boolean allowDevUserHeader,
            SecurityIdentity securityIdentity) {
        this.ownerEmails = normalizeOwners(ownerEmails);
        this.allowDevUserHeader = allowDevUserHeader;
        this.securityIdentity = securityIdentity;
    }

    /**
     * @param devUserEmailHeader the request's {@code X-Dev-User-Email}, honoured
     *                           only when {@code miot.platform.allow-dev-user-header} is on
     * @return the caller's email, once confirmed to be a platform owner
     * @throws ForbiddenException when it is not, or cannot be resolved
     */
    public String requirePlatformOwner(String devUserEmailHeader) {
        String email = resolveEmail(devUserEmailHeader);
        if (email == null) {
            throw new ForbiddenException("Cannot resolve caller identity");
        }
        if (!isOwner(ownerEmails, email)) {
            throw new ForbiddenException("Platform owner role required");
        }
        return email;
    }

    private String resolveEmail(String devUserEmailHeader) {
        if (securityIdentity != null && !securityIdentity.isAnonymous()
                && securityIdentity.getPrincipal() instanceof JsonWebToken jwt) {
            String email = jwt.getClaim("email");
            if (email != null && !email.isBlank()) {
                return email;
            }
        }
        // Off by default. OrganizationRequestFilter honours this header
        // unconditionally, which is tolerable for an org-membership check but
        // not for platform scope, so here it takes an explicit opt-in.
        if (allowDevUserHeader && devUserEmailHeader != null && !devUserEmailHeader.isBlank()) {
            return devUserEmailHeader;
        }
        return null;
    }

    static Set<String> normalizeOwners(List<String> configured) {
        Set<String> owners = new HashSet<>();
        if (configured == null) {
            return owners;
        }
        for (String entry : configured) {
            if (entry != null && !entry.isBlank()) {
                owners.add(entry.trim().toLowerCase(Locale.ROOT));
            }
        }
        return owners;
    }

    static boolean isOwner(Set<String> owners, String email) {
        return email != null && owners.contains(email.trim().toLowerCase(Locale.ROOT));
    }
}
