package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.api.dto.OrganizationScopeDto;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationModule;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.runtime.LaunchMode;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * "Who am I, and what can I see?" — resolves the caller's Alfresco memberships
 * into a list of {@link OrganizationScopeDto}s. This is the single bridge
 * between Alfresco authorities and the tenant scoping the Next.js app uses
 * to filter pgrest queries by {@code cust_account}.
 *
 * <p>The caller is identified by the {@code email} claim on the JWT, or by
 * an {@code X-Dev-User-Email} header in dev. For every active organization
 * whose {@code alfresco_group_id} is set, this resource calls
 * {@link IAlfrescoMembershipClient#isMember(String, String)} and includes the
 * org in the response only when the caller is a member.
 *
 * <p>For parent orgs, {@code effectiveTaxIds} is the union of all active child
 * orgs' tax ids (so a GAMA admin can see every sub-account's data). For child
 * orgs, it's a single-element list (or empty when tax_id is null).
 *
 * <p>Not org-scoped — this endpoint intentionally runs outside
 * {@code /api/v1/orgs/} so it bypasses {@code OrganizationRequestFilter}.
 */
@Path("/api/v1/me")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Me", description = "Current user scopes and organization memberships")
@SecurityRequirement(name = "oidc")
public class MeResource {

    private final SecurityIdentity securityIdentity;
    private final IAlfrescoMembershipClient membershipClient;

    @Inject
    public MeResource(SecurityIdentity securityIdentity,
                      IAlfrescoMembershipClient membershipClient) {
        this.securityIdentity = securityIdentity;
        this.membershipClient = membershipClient;
    }

    @GET
    @Path("/scopes")
    @Operation(summary = "List the caller's resolved organization scopes",
            description = "Returns one entry per organization the caller is a member of, "
                    + "including the effective tax ids and enabled product modules. "
                    + "Used by the Next.js app to inject cust_account filters into pgrest queries.")
    public Uni<List<OrganizationScopeDto>> scopes(@Context HttpHeaders headers) {
        String email = resolveEmail(headers);
        if (email == null) {
            return Uni.createFrom().item(List.of());
        }
        return Panache.withSession(() ->
                Organization.listAllActive()
                        .flatMap(orgs -> buildScopesForCaller(orgs, email)));
    }

    private Uni<List<OrganizationScopeDto>> buildScopesForCaller(List<Organization> orgs, String email) {
        // Sequential chain: Phase 1 uses the stub client so this is effectively free.
        // A real Alfresco client with getGroupsForPerson will replace this per-org
        // membership check with a single lookup + in-memory filter.
        Uni<List<OrganizationScopeDto>> acc = Uni.createFrom().item(new ArrayList<>());
        for (Organization org : orgs) {
            if (org.alfrescoGroupId == null) {
                continue; // orgs without an Alfresco binding are invisible
            }
            acc = acc.flatMap(list -> buildScopeIfMember(org, email)
                    .map(scope -> {
                        if (scope != null) {
                            list.add(scope);
                        }
                        return list;
                    }));
        }
        // Unmodifiable copy so the outer list isn't mutated post-return.
        return acc.map(List::copyOf);
    }

    private Uni<OrganizationScopeDto> buildScopeIfMember(Organization org, String email) {
        return membershipClient.isMember(email, org.alfrescoGroupId)
                .flatMap(isMember -> {
                    if (!Boolean.TRUE.equals(isMember)) {
                        return Uni.createFrom().nullItem();
                    }
                    return membershipClient.getRole(email, org.alfrescoGroupId)
                            .flatMap(role -> assembleScope(org, role));
                });
    }

    private Uni<OrganizationScopeDto> assembleScope(Organization org, String role) {
        // Sequential chain — Hibernate Reactive does not support concurrent queries
        // on the same session, so `Uni.combine().all()` would race and throw
        // "Illegal pop() with non-matching JdbcValuesSourceProcessingState".
        return OrganizationModule.findEnabledByOrganization(org.id)
                .flatMap(modules -> resolveEffectiveTaxIds(org)
                        .map(taxIds -> new OrganizationScopeDto(
                                org.id,
                                org.slug,
                                org.displayName != null ? org.displayName : org.name,
                                org.taxId,
                                role,
                                org.parent == null,
                                taxIds,
                                modules.stream().map(m -> m.id.moduleCode).toList())));
    }

    private Uni<List<String>> resolveEffectiveTaxIds(Organization org) {
        if (org.parent != null) {
            return Uni.createFrom().item(
                    org.taxId != null ? List.of(org.taxId) : List.of());
        }
        return Organization.findByParent(org.id)
                .map(children -> children.stream()
                        .map(child -> child.taxId)
                        .filter(Objects::nonNull)
                        .toList());
    }

    private String resolveEmail(HttpHeaders headers) {
        if (securityIdentity != null && !securityIdentity.isAnonymous()) {
            var principal = securityIdentity.getPrincipal();
            if (principal instanceof JsonWebToken jwt) {
                String email = jwt.getClaim("email");
                if (email != null && !email.isBlank()) {
                    return email;
                }
            }
        }
        // Dev fallback — matches OrganizationRequestFilter.resolveEmail()
        if (isDevImpersonationAllowed()) {
            return headers.getHeaderString("X-Dev-User-Email");
        }
        return null;
    }

    private boolean isDevImpersonationAllowed() {
        LaunchMode launchMode = LaunchMode.current();
        return launchMode == LaunchMode.DEVELOPMENT || launchMode == LaunchMode.TEST;
    }
}
