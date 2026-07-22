package com.microboxlabs.miot.core.alfresco;

import io.quarkus.arc.lookup.LookupUnlessProperty;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Resolves organization membership from Alfresco groups and site roles from
 * Alfresco's authoritative site-membership resource.
 * Active whenever the deployment selects a real Alfresco authentication mode.
 */
@ApplicationScoped
@LookupUnlessProperty(name = "miot.alfresco.auth", stringValue = "stub", lookupIfMissing = false)
public class RealAlfrescoMembershipClient implements IAlfrescoMembershipClient {

    private static final int PAGE_SIZE = 50;
    private static final String SITE_GROUP_PREFIX = "GROUP_site_";

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
            String siteId = groupId.substring(SITE_GROUP_PREFIX.length());
            return directoryClient.getSiteRole(personId, siteId)
                    .map(RealAlfrescoMembershipClient::toCanonicalSiteRole);
        }
        return containsPerson(groupId, personId, 0)
                .map(found -> found ? "GROUP_MEMBER" : null);
    }

    private static String toCanonicalSiteRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return switch (role) {
            case "SiteManager" -> "SITE_MANAGER";
            case "SiteCollaborator" -> "SITE_COLLABORATOR";
            case "SiteContributor" -> "SITE_CONTRIBUTOR";
            case "SiteConsumer" -> "SITE_CONSUMER";
            default -> null;
        };
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
}
