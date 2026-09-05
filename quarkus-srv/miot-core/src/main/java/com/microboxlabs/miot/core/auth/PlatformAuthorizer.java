package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.model.PlatformRoleAssignment;
import com.microboxlabs.miot.core.permission.PlatformRoleDefinition;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Authorizes platform-scope requests — the ones that are not about a single
 * organization, such as per-domain branding.
 *
 * <p>{@link WriteAuthorizer} cannot express this: its rule is "SITE_MANAGER on
 * the parent org", and a domain belongs to no org. Nor can
 * {@link OrganizationRequestFilter} help, since it only intercepts
 * {@code /api/v1/orgs/**} and so leaves {@link OrganizationContext} empty here.
 *
 * <p>The caller's identity comes only from a verified JWT. There is no
 * development header equivalent to the one {@code OrganizationRequestFilter}
 * accepts: platform scope spans every organization, and a token with no
 * {@code email} claim — an M2M client — could otherwise name any owner it liked.
 *
 * <p>Two grants, either of which suffices:
 *
 * <ul>
 *   <li>{@code miot.platform.owner-emails}, empty by default. It answers who
 *       grants the first database owner, and is the way back in when the table
 *       is empty or wrong. Changing it needs a deployment, which is what makes
 *       it break-glass rather than the everyday mechanism.
 *   <li>{@code PLATFORM_OWNER} in {@code miot_core.platform_role_assignments},
 *       managed through {@code /api/v1/platform/roles} and visible in the
 *       product.
 * </ul>
 *
 * <p>The configured list is consulted first so that the break-glass path needs
 * no database, which is the state it exists for.
 */
@ApplicationScoped
public class PlatformAuthorizer {

    private final Set<String> bootstrapOwners;
    private final SecurityIdentity securityIdentity;

    /**
     * The list is {@link Optional} rather than a {@code defaultValue = ""}: an
     * empty string has no conversion to {@code List<String>}, so the default
     * form fails to construct the bean whenever the property is unset — which
     * is its normal state, and would stop the application booting.
     */
    @Inject
    public PlatformAuthorizer(
            @ConfigProperty(name = "miot.platform.owner-emails")
            Optional<List<String>> ownerEmails,
            SecurityIdentity securityIdentity) {
        this.bootstrapOwners = normalizeOwners(ownerEmails.orElse(List.of()));
        this.securityIdentity = securityIdentity;
    }

    /** The emails granted by configuration, already normalized. */
    public Set<String> bootstrapOwners() {
        return Set.copyOf(bootstrapOwners);
    }

    /**
     * @return the caller's email, once confirmed to be a platform owner
     * @throws ForbiddenException when it is not, or cannot be resolved
     */
    public Uni<String> requirePlatformOwner() {
        String email = requireCallerEmail();
        return isPlatformOwner(email)
                .flatMap(owner -> Boolean.TRUE.equals(owner)
                        ? Uni.createFrom().item(email)
                        : Uni.createFrom().failure(
                                new ForbiddenException("Platform owner role required")));
    }

    /** Does not throw when the caller is not an owner — for reporting held roles. */
    public Uni<Boolean> isPlatformOwner(String email) {
        if (email == null) {
            return Uni.createFrom().item(false);
        }
        if (isOwner(bootstrapOwners, email)) {
            return Uni.createFrom().item(true);
        }
        return Panache.withSession(() -> PlatformRoleAssignment.hasAssignment(
                PlatformRoleDefinition.OWNER.roleCode(), normalize(email)));
    }

    /**
     * @throws ForbiddenException when the request carries no usable identity
     */
    public String requireCallerEmail() {
        String email = resolveEmail();
        if (email == null) {
            throw new ForbiddenException("Cannot resolve caller identity");
        }
        return email;
    }

    private String resolveEmail() {
        if (securityIdentity != null && !securityIdentity.isAnonymous()
                && securityIdentity.getPrincipal() instanceof JsonWebToken jwt) {
            String email = jwt.getClaim("email");
            if (email != null && !email.isBlank()) {
                return email;
            }
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
                owners.add(normalize(entry));
            }
        }
        return owners;
    }

    static boolean isOwner(Set<String> owners, String email) {
        return email != null && owners.contains(normalize(email));
    }

    /** Public because assignments must be stored the way this class compares them. */
    public static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
