package com.microboxlabs.miot.core.alfresco;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RealAlfrescoMembershipClientTest {

    @Test
    void resolvesSiteManagerFromAuthoritativeSiteMembership() {
        RealAlfrescoMembershipClient client = new RealAlfrescoMembershipClient(
                new FakeDirectory(Map.of(), Map.of(
                        "mintral:manager@example.com", "SiteManager")));

        assertTrue(client.isMember("manager@example.com", "GROUP_site_mintral")
                .await().indefinitely());
        assertEquals("SITE_MANAGER", client.getRole(
                "manager@example.com", "GROUP_site_mintral").await().indefinitely());
    }

    @Test
    void rejectsPersonOutsideEverySiteRoleGroup() {
        RealAlfrescoMembershipClient client =
                new RealAlfrescoMembershipClient(new FakeDirectory(Map.of(), Map.of()));

        assertFalse(client.isMember("outsider@example.com", "GROUP_site_mintral")
                .await().indefinitely());
    }

    private record FakeDirectory(
            Map<String, List<AlfrescoPerson>> groups,
            Map<String, String> siteRoles)
            implements IAlfrescoDirectoryClient {

        @Override
        public Uni<List<AlfrescoPerson>> listGroupMembers(
                String groupId, int maxItems, int skipCount) {
            List<AlfrescoPerson> members = groups.getOrDefault(groupId, List.of());
            int end = Math.min(skipCount + maxItems, members.size());
            return Uni.createFrom().item(skipCount >= members.size()
                    ? List.of()
                    : List.copyOf(members.subList(skipCount, end)));
        }

        @Override
        public Uni<String> getSiteRole(String personId, String siteId) {
            return Uni.createFrom().item(siteRoles.get(siteId + ":" + personId));
        }

        @Override
        public Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems) {
            return Uni.createFrom().item(List.of());
        }
    }
}
