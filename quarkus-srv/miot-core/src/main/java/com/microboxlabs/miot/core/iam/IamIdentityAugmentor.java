package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.auth.OrganizationAccess;
import io.quarkus.security.identity.AuthenticationRequestContext;
import io.quarkus.runtime.LaunchMode;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.SecurityIdentityAugmentor;
import io.quarkus.security.runtime.QuarkusPrincipal;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.quarkus.vertx.http.runtime.security.HttpSecurityUtils;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Lets {@code @PermissionsAllowed(permission = OrgPermission.class)} ask {@link AccessEvaluator}. Quarkus applies it
 * to identities that come through the identity provider manager; {@code DualJwtAuthMechanism}, which builds its
 * identities itself, calls {@link #withOrgPermissions} directly.
 */
@ApplicationScoped
public class IamIdentityAugmentor implements SecurityIdentityAugmentor {

    public static final String DEV_EMAIL_HEADER = "X-Dev-User-Email";

    /**
     * {@link #DEV_EMAIL_HEADER} names the user only in dev and test mode. Elsewhere the token's
     * email is the only source, so a token without one cannot claim to be a user.
     */
    public static boolean devHeaderAllowed() {
        return devHeaderAllowed(LaunchMode.current());
    }

    static boolean devHeaderAllowed(LaunchMode mode) {
        return mode == LaunchMode.DEVELOPMENT || mode == LaunchMode.TEST;
    }
    public static final String SERVICE_ACCOUNT_ROLE = "service-account";
    static final String SERVICE_ACCOUNT_ID = "miot.service-account.id";
    static final String SERVICE_ACCOUNT_ORGANIZATION = "miot.service-account.organization";

    private final AccessEvaluator evaluator;
    private final List<String> clientIdClaims;

    @Inject
    public IamIdentityAugmentor(AccessEvaluator evaluator,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
            List<String> clientIdClaims) {
        this.evaluator = evaluator;
        this.clientIdClaims = clientIdClaims;
    }

    @Override
    public Uni<SecurityIdentity> augment(SecurityIdentity identity, AuthenticationRequestContext context) {
        if (identity.isAnonymous()) {
            return Uni.createFrom().item(identity);
        }
        RoutingContext routing = HttpSecurityUtils.getRoutingContextAttribute(identity);
        String headerEmail = routing == null ? null : routing.request().getHeader(DEV_EMAIL_HEADER);
        return Uni.createFrom().item(withOrgPermissions(identity, headerEmail));
    }

    /** The identity plus a checker that answers {@link OrgPermission}s through the evaluator. */
    public SecurityIdentity withOrgPermissions(SecurityIdentity identity, String headerEmail) {
        Caller caller = callerOf(identity, headerEmail, clientIdClaims);
        return QuarkusSecurityIdentity.builder(identity)
                .addPermissionChecker(permission -> permission instanceof OrgPermission required
                        ? evaluator.evaluate(required.organizationId(), caller)
                                .map(access -> access.can(required.getName()))
                        : Uni.createFrom().item(false))
                .build();
    }

    /**
     * The caller as {@code OrganizationRequestFilter} sees it: the token's email, else the dev header, else the
     * token's client id.
     */
    public static Caller callerOf(SecurityIdentity identity, String headerEmail, List<String> clientIdClaims) {
        return callerOf(identity, headerEmail, clientIdClaims, LaunchMode.current());
    }

    /** {@code headerEmail} when the dev header may name a user in this launch mode, else null. */
    public static String devHeaderEmail(String headerEmail) {
        return devHeaderEmail(headerEmail, LaunchMode.current());
    }

    static String devHeaderEmail(String headerEmail, LaunchMode mode) {
        return devHeaderAllowed(mode) && headerEmail != null && !headerEmail.isBlank() ? headerEmail : null;
    }

    static Caller callerOf(SecurityIdentity identity, String headerEmail, List<String> clientIdClaims,
            LaunchMode mode) {
        Caller serviceAccount = serviceAccountOf(identity);
        if (serviceAccount != null) {
            return serviceAccount;
        }
        String email = OrganizationAccess.email(identity);
        if (email == null) {
            email = devHeaderEmail(headerEmail, mode);
        }
        if (email != null) {
            return Caller.user(email);
        }
        return Caller.client(OrganizationAccess.clientId(identity, clientIdClaims));
    }

    /** The identity of an API key's service account. */
    public static SecurityIdentity serviceAccountIdentity(ApiKeyService.Holder holder) {
        return QuarkusSecurityIdentity.builder()
                .setPrincipal(new QuarkusPrincipal("service-account:" + holder.serviceAccountId()))
                .addRole(SERVICE_ACCOUNT_ROLE)
                .addAttribute(SERVICE_ACCOUNT_ID, holder.serviceAccountId())
                .addAttribute(SERVICE_ACCOUNT_ORGANIZATION, holder.organizationId())
                .build();
    }

    /** The service account an API key authenticated, or null for any other identity. */
    public static Caller serviceAccountOf(SecurityIdentity identity) {
        if (identity == null || identity.isAnonymous()) {
            return null;
        }
        Object id = identity.getAttribute(SERVICE_ACCOUNT_ID);
        Object org = identity.getAttribute(SERVICE_ACCOUNT_ORGANIZATION);
        return id instanceof UUID uuid && org instanceof Long orgId ? Caller.serviceAccount(uuid, orgId) : null;
    }
}
