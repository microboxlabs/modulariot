package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.alfresco.IAlfrescoGroupAdminClient;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/** Reconciles a desired set of people into an Alfresco authority group. */
@ApplicationScoped
public class AlfrescoGroupProjector {

    private static final int PAGE_SIZE = 50;

    private final IAlfrescoDirectoryClient directoryClient;
    private final IAlfrescoGroupAdminClient groupAdmin;

    @Inject
    public AlfrescoGroupProjector(
            IAlfrescoDirectoryClient directoryClient,
            IAlfrescoGroupAdminClient groupAdmin) {
        this.directoryClient = directoryClient;
        this.groupAdmin = groupAdmin;
    }

    public Uni<Void> reconcile(String groupId, String displayName, Set<String> desired) {
        return groupAdmin.createGroup(groupId, displayName)
                .flatMap(ignored -> listAllMembers(groupId))
                .flatMap(currentMembers -> {
                    Set<String> current = currentMembers.stream()
                            .map(AlfrescoPerson::id)
                            .collect(java.util.stream.Collectors.toSet());
                    return applyMembershipDelta(groupId, current, desired);
                })
                .flatMap(ignored -> verifyMembership(groupId, desired)
                        .onFailure(IllegalStateException.class)
                        .retry()
                        .withBackOff(Duration.ofMillis(200), Duration.ofSeconds(2))
                        .atMost(5));
    }

    /**
     * Verify the repository state instead of treating successful mutation
     * responses as proof that Alfresco applied the requested membership.
     */
    public Uni<Void> verifyMembership(String groupId, Set<String> desired) {
        return Uni.createFrom().deferred(() -> listAllMembers(groupId))
                .invoke(currentMembers -> {
                    Set<String> current = currentMembers.stream()
                            .map(AlfrescoPerson::id)
                            .collect(java.util.stream.Collectors.toSet());
                    Set<String> missing = new TreeSet<>(desired);
                    missing.removeAll(current);
                    Set<String> unexpected = new TreeSet<>(current);
                    unexpected.removeAll(desired);
                    if (!missing.isEmpty() || !unexpected.isEmpty()) {
                        throw new IllegalStateException(
                                "Alfresco group " + groupId
                                        + " is out of sync; missing=" + missing
                                        + ", unexpected=" + unexpected);
                    }
                })
                .replaceWithVoid();
    }

    private Uni<Void> applyMembershipDelta(
            String groupId, Set<String> current, Set<String> desired) {
        Set<String> additions = new TreeSet<>(desired);
        additions.removeAll(current);
        Set<String> removals = new TreeSet<>(current);
        removals.removeAll(desired);

        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String personId : additions) {
            chain = chain.flatMap(ignored -> groupAdmin.addGroupMember(groupId, personId));
        }
        for (String personId : removals) {
            chain = chain.flatMap(ignored -> groupAdmin.removeGroupMember(groupId, personId));
        }
        return chain;
    }

    private Uni<List<AlfrescoPerson>> listAllMembers(String groupId) {
        return listAllMembers(groupId, 0, new ArrayList<>());
    }

    private Uni<List<AlfrescoPerson>> listAllMembers(
            String groupId, int skipCount, List<AlfrescoPerson> collected) {
        return directoryClient.listGroupMembers(groupId, PAGE_SIZE, skipCount)
                .flatMap(page -> {
                    collected.addAll(page);
                    if (page.size() < PAGE_SIZE) {
                        return Uni.createFrom().item(List.copyOf(collected));
                    }
                    return listAllMembers(groupId, skipCount + PAGE_SIZE, collected);
                });
    }
}
