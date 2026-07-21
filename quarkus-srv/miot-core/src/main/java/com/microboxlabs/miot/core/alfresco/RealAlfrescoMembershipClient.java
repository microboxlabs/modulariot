package com.microboxlabs.miot.core.alfresco;

import io.quarkus.arc.lookup.LookupUnlessProperty;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Resolves organization membership and site roles from Alfresco groups.
 * Active whenever the deployment selects a real Alfresco authentication mode.
 */
@ApplicationScoped
@LookupUnlessProperty(name = "miot.alfresco.auth", stringValue = "stub", lookupIfMissing = false)
public class RealAlfrescoMembershipClient implements IAlfrescoMembershipClient {

    private static final int PAGE_SIZE = 50;
    private static final String SITE_GROUP_PREFIX = "GROUP_site_";
    private static final List<SiteRole> SITE_ROLES = List.of(
            new SiteRole("_SiteManager", "SITE_MANAGER"),
            new SiteRole("_SiteCollaborator", "SITE_COLLABORATOR"),
            new SiteRole("_SiteContributor", "SITE_CONTRIBUTOR"),
            new SiteRole("_SiteConsumer", "SITE_CONSUMER"));

    private final IAlfrescoDirectoryClient directoryClient;

    public RealAlfrescoMembershipClient(IAlfrescoDirectoryClient directoryClient) {
        this.directoryClient = directoryClient;
    }

    @Override
    public Uni<Boolean> isMember(String personId, String groupId) {
        return getRole(personId, groupId).map(role -> role != null);
    }

    @Override
    public Uni<String> getRole(String personId, String groupId) {
        if (groupId.startsWith(SITE_GROUP_PREFIX)) {
            return findSiteRole(personId, groupId, 0);
        }
        return containsPerson(groupId, personId, 0)
                .map(found -> found ? "GROUP_MEMBER" : null);
    }

    private Uni<String> findSiteRole(String personId, String siteGroupId, int roleIndex) {
        if (roleIndex >= SITE_ROLES.size()) {
            return Uni.createFrom().nullItem();
        }
        SiteRole role = SITE_ROLES.get(roleIndex);
        return containsPerson(siteGroupId + role.groupSuffix(), personId, 0)
                .flatMap(found -> found
                        ? Uni.createFrom().item(role.roleName())
                        : findSiteRole(personId, siteGroupId, roleIndex + 1));
    }

    private Uni<Boolean> containsPerson(String groupId, String personId, int skipCount) {
        return directoryClient.listGroupMembers(groupId, PAGE_SIZE, skipCount)
                .flatMap(page -> {
                    boolean found = page.stream().anyMatch(person -> personId.equals(person.id()));
                    if (found || page.size() < PAGE_SIZE) {
                        return Uni.createFrom().item(found);
                    }
                    return containsPerson(groupId, personId, skipCount + PAGE_SIZE);
                });
    }

    private record SiteRole(String groupSuffix, String roleName) {
    }
}
