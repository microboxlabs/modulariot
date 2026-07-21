package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.alfresco.IAlfrescoGroupAdminClient;
import io.smallrye.mutiny.Uni;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AlfrescoGroupProjectorTest {

    @Test
    void reconcilesAllPagesWithDeterministicMembershipDelta() {
        FakeAlfresco alfresco = new FakeAlfresco();
        for (int index = 0; index < 51; index++) {
            alfresco.current.add(person("existing-" + index));
        }
        AlfrescoGroupProjector projector = new AlfrescoGroupProjector(alfresco, alfresco);

        projector.reconcile(
                "GROUP_MINTRAL_AUTO_APPROVERS",
                "Multimedia content auto approvers",
                Set.of("existing-0", "new-user"))
                .await().indefinitely();

        assertEquals(List.of("GROUP_MINTRAL_AUTO_APPROVERS"), alfresco.createdGroups);
        assertEquals(List.of("new-user"), alfresco.added);
        assertEquals(50, alfresco.removed.size());
        assertEquals(List.of(0, 50, 0), alfresco.requestedOffsets);
    }

    @Test
    void rejectsAFalsePositiveWhenAlfrescoDoesNotApplyTheDelta() {
        FakeAlfresco alfresco = new FakeAlfresco();
        alfresco.ignoreMutations = true;
        AlfrescoGroupProjector projector = new AlfrescoGroupProjector(alfresco, alfresco);

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> projector.reconcile(
                                "GROUP_MINTRAL_AUTO_APPROVERS_SITE_MINTRAL",
                                "Multimedia content auto approvers",
                                Set.of("mdavid@sitrans.cl"))
                        .await().indefinitely());

        assertTrue(error.getMessage().contains("missing=[mdavid@sitrans.cl]"));
    }

    @Test
    void retriesVerificationWhileAlfrescoMembershipIsNotYetVisible() {
        FakeAlfresco alfresco = new FakeAlfresco();
        alfresco.staleReadsAfterMutation = 1;
        AlfrescoGroupProjector projector = new AlfrescoGroupProjector(alfresco, alfresco);

        projector.reconcile(
                        "GROUP_MINTRAL_AUTO_APPROVERS_SITE_MINTRAL",
                        "Multimedia content auto approvers",
                        Set.of("mdavid@sitrans.cl"))
                .await().indefinitely();

        assertEquals(List.of("mdavid@sitrans.cl"), alfresco.added);
        assertEquals(List.of("mdavid@sitrans.cl"),
                alfresco.current.stream().map(AlfrescoPerson::id).toList());
    }

    private static AlfrescoPerson person(String id) {
        return new AlfrescoPerson(id, id, null, null, id);
    }

    private static final class FakeAlfresco
            implements IAlfrescoDirectoryClient, IAlfrescoGroupAdminClient {

        private final List<AlfrescoPerson> current = new ArrayList<>();
        private final List<String> createdGroups = new ArrayList<>();
        private final List<String> added = new ArrayList<>();
        private final List<String> removed = new ArrayList<>();
        private final List<Integer> requestedOffsets = new ArrayList<>();
        private final List<AlfrescoPerson> pendingAdditions = new ArrayList<>();
        private boolean ignoreMutations;
        private int staleReadsAfterMutation;

        @Override
        public Uni<List<AlfrescoPerson>> listGroupMembers(
                String groupId, int maxItems, int skipCount) {
            requestedOffsets.add(skipCount);
            if (!pendingAdditions.isEmpty()) {
                if (staleReadsAfterMutation > 0) {
                    staleReadsAfterMutation--;
                } else {
                    current.addAll(pendingAdditions);
                    pendingAdditions.clear();
                }
            }
            int end = Math.min(skipCount + maxItems, current.size());
            return Uni.createFrom().item(skipCount >= current.size()
                    ? List.of()
                    : List.copyOf(current.subList(skipCount, end)));
        }

        @Override
        public Uni<String> getSiteRole(String personId, String siteId) {
            return Uni.createFrom().nullItem();
        }

        @Override
        public Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems) {
            return Uni.createFrom().item(List.of());
        }

        @Override
        public Uni<String> createGroup(String groupId, String displayName) {
            createdGroups.add(groupId);
            return Uni.createFrom().item(groupId);
        }

        @Override
        public Uni<Void> addGroupMember(String groupId, String personId) {
            added.add(personId);
            if (!ignoreMutations) {
                if (staleReadsAfterMutation > 0) {
                    pendingAdditions.add(person(personId));
                } else {
                    current.add(person(personId));
                }
            }
            return Uni.createFrom().voidItem();
        }

        @Override
        public Uni<Void> removeGroupMember(String groupId, String personId) {
            removed.add(personId);
            if (!ignoreMutations) {
                current.removeIf(person -> personId.equals(person.id()));
            }
            return Uni.createFrom().voidItem();
        }
    }
}
