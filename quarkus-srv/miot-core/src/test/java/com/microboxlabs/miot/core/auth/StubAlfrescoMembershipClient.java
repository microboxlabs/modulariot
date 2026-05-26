package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import io.smallrye.mutiny.Uni;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;

/**
 * Test-only Alfresco membership stub. Approves a single fixed email
 * ({@link #MEMBER_EMAIL}) and denies everything else, so the
 * {@code OrganizationRequestFilter} web-user branch produces a clean
 * 200 vs 403 split in {@link AuthTestInfrastructureTest} and the rungs
 * that follow.
 *
 * <p>Activated via {@code @Alternative @Priority(1)} (auto-selected by ArC),
 * overriding the production {@code @DefaultBean} stub in
 * {@code com.microboxlabs.miot.core.alfresco}.
 */
@ApplicationScoped
@Alternative
@Priority(1)
public class StubAlfrescoMembershipClient implements IAlfrescoMembershipClient {

    public static final String MEMBER_EMAIL = "member@test.example";
    public static final String MEMBER_ROLE = "SITE_MANAGER";

    @Override
    public Uni<Boolean> isMember(String personId, String groupId) {
        return Uni.createFrom().item(MEMBER_EMAIL.equalsIgnoreCase(personId));
    }

    @Override
    public Uni<String> getRole(String personId, String groupId) {
        return MEMBER_EMAIL.equalsIgnoreCase(personId)
                ? Uni.createFrom().item(MEMBER_ROLE)
                : Uni.createFrom().nullItem();
    }
}
