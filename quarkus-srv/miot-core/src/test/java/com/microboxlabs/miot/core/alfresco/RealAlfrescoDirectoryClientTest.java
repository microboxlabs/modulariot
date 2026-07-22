package com.microboxlabs.miot.core.alfresco;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.alfresco.client.AddGroupMemberRequest;
import com.microboxlabs.miot.core.alfresco.client.AlfrescoCoreApi;
import com.microboxlabs.miot.core.alfresco.client.CreateGroupRequest;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoGroupMemberEntry;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoListResponse;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoPersonEntry;
import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RealAlfrescoDirectoryClientTest {

    @Test
    void recursivelyFlattensSiteRoleGroupsAndDeduplicatesPeople() {
        FakeAlfrescoCoreApi api = new FakeAlfrescoCoreApi();
        RealAlfrescoDirectoryClient client = new RealAlfrescoDirectoryClient(api);

        List<AlfrescoPerson> members = client.listGroupMembers(
                "GROUP_site_mintral", 50, 0).await().indefinitely();

        assertEquals(List.of("alice@example.com", "bob@example.com"),
                members.stream().map(AlfrescoPerson::id).toList());
        assertEquals("Alice Reviewer", members.getFirst().displayName());
    }

    @Test
    void appliesPaginationAfterFlatteningNestedGroups() {
        RealAlfrescoDirectoryClient client =
                new RealAlfrescoDirectoryClient(new FakeAlfrescoCoreApi());

        List<AlfrescoPerson> members = client.listGroupMembers(
                "GROUP_site_mintral", 1, 1).await().indefinitely();

        assertEquals(List.of("bob@example.com"),
                members.stream().map(AlfrescoPerson::id).toList());
    }

    @Test
    void resolvesTheAuthoritativeSiteRole() {
        RealAlfrescoDirectoryClient client =
                new RealAlfrescoDirectoryClient(new FakeAlfrescoCoreApi());

        assertEquals("SiteManager", client.getSiteRole("alice@example.com", "mintral")
                .await().indefinitely());
    }

    static final class FakeAlfrescoCoreApi implements AlfrescoCoreApi {

        private final Map<String, List<AlfrescoGroupMemberEntry>> groups = Map.of(
                "GROUP_site_mintral", List.of(
                        group("GROUP_site_mintral_SiteManager"),
                        group("GROUP_site_mintral_SiteCollaborator")),
                "GROUP_site_mintral_SiteManager", List.of(
                        person("alice@example.com", "Alice Reviewer")),
                "GROUP_site_mintral_SiteCollaborator", List.of(
                        person("bob@example.com", "Bob Operator"),
                        person("alice@example.com", "Alice Reviewer"),
                        group("GROUP_site_mintral")));

        @Override
        public Uni<AlfrescoListResponse<AlfrescoGroupMemberEntry>> listGroupMembers(
                String groupId, int maxItems, int skipCount) {
            List<AlfrescoGroupMemberEntry> entries = groups.getOrDefault(groupId, List.of());
            int end = Math.min(skipCount + maxItems, entries.size());
            List<AlfrescoGroupMemberEntry> page = skipCount >= entries.size()
                    ? List.of()
                    : entries.subList(skipCount, end);
            return Uni.createFrom().item(response(page));
        }

        @Override
        public Uni<SinglePersonEntry> getPerson(String personId) {
            String firstName = personId.startsWith("alice") ? "Alice" : "Bob";
            String lastName = personId.startsWith("alice") ? "Reviewer" : "Operator";
            return Uni.createFrom().item(new SinglePersonEntry(new AlfrescoPersonEntry(
                    personId, firstName, lastName, firstName + " " + lastName, personId)));
        }

        @Override
        public Uni<SingleSiteMemberEntry> getSiteMember(String siteId, String personId) {
            return Uni.createFrom().item(new SingleSiteMemberEntry(
                    new AlfrescoSiteMemberEntry(personId, "SiteManager")));
        }

        @Override
        public Uni<AlfrescoListResponse<AlfrescoPersonEntry>> searchPeople(
                String term, int maxItems) {
            return unsupported();
        }

        @Override
        public Uni<SingleGroupEntry> createGroup(CreateGroupRequest body) {
            return unsupported();
        }

        @Override
        public Uni<SingleMemberEntry> addGroupMember(
                String groupId, AddGroupMemberRequest body) {
            return unsupported();
        }

        @Override
        public Uni<Void> removeGroupMember(String groupId, String personId) {
            return unsupported();
        }

        private static <T> Uni<T> unsupported() {
            return Uni.createFrom().failure(new UnsupportedOperationException());
        }

        private static AlfrescoListResponse<AlfrescoGroupMemberEntry> response(
                List<AlfrescoGroupMemberEntry> members) {
            List<AlfrescoListResponse.AlfrescoEntry<AlfrescoGroupMemberEntry>> entries =
                    members.stream().map(AlfrescoListResponse.AlfrescoEntry::new).toList();
            return new AlfrescoListResponse<>(new AlfrescoListResponse.AlfrescoList<>(entries));
        }

        private static AlfrescoGroupMemberEntry group(String id) {
            return new AlfrescoGroupMemberEntry(id, id, "GROUP");
        }

        private static AlfrescoGroupMemberEntry person(String id, String displayName) {
            return new AlfrescoGroupMemberEntry(id, displayName, "PERSON");
        }
    }
}
