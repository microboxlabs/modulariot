package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamGroupRole;
import com.microboxlabs.miot.core.iam.model.IamProjectionChange;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamTeamMember;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Queues projected-group changes as soon as roles change, in the same transaction, for {@link AlfrescoBridge} to send.
 * For each affected user and projected group: added when the user is active and holds a role mapped to the group
 * (directly or through a team), removed otherwise. Adding a member twice and removing a non-member are both no-ops in
 * Alfresco. {@link RoleProjection} reconciles periodically for what this does not see: expired bindings and changes
 * made in Alfresco.
 */
@ApplicationScoped
public class ProjectionQueue {

    private final boolean projection;

    @Inject
    public ProjectionQueue(@ConfigProperty(name = AlfrescoBridge.PROJECTION_PROPERTY, defaultValue = "false")
            boolean projection) {
        this.projection = projection;
    }

    /**
     * After {@code email} joined ({@code member} true) or left an organization: queues the change to the org's
     * member group (see {@link AlfrescoBridge#memberGroupOf}). Needs an open transaction.
     */
    @SuppressWarnings("java:S3252") // Reactive Panache generates findById per entity.
    public Uni<Void> memberChanged(Long organizationId, String email, boolean member) {
        if (!projection || email == null) {
            return Uni.createFrom().voidItem();
        }
        return Organization.<Organization>findById(organizationId).flatMap(org -> {
            if (org == null || org.alfrescoGroupId == null) {
                return Uni.createFrom().voidItem();
            }
            String kind = member ? IamProjectionChange.MEMBER_ADDED : IamProjectionChange.MEMBER_REMOVED;
            return queueOnce(org.id, kind, AlfrescoBridge.memberGroupOf(org.alfrescoGroupId),
                    IamUser.normalize(email));
        });
    }

    /**
     * After the roles of {@code userIds} changed in top-level organization {@code rootId}. Only groups mapped to one of
     * {@code roles} are affected; null means every projected group. Needs an open transaction.
     */
    public Uni<Void> usersChanged(Long rootId, Collection<UUID> userIds, Collection<String> roles) {
        if (!projection || userIds.isEmpty()) {
            return Uni.createFrom().voidItem();
        }
        List<UUID> users = List.copyOf(new LinkedHashSet<>(userIds));
        return Panache.flush().flatMap(f -> IamGroupRole.findByOrganization(rootId)).flatMap(rows -> {
            Map<String, Set<String>> rolesByGroup = projectedGroups(rows, roles);
            if (rolesByGroup.isEmpty()) {
                return Uni.createFrom().voidItem();
            }
            return IamUser.findByIds(users).flatMap(found -> {
                Uni<Void> chain = Uni.createFrom().voidItem();
                for (IamUser user : found) {
                    chain = chain.flatMap(i -> queueFor(rootId, user, rolesByGroup));
                }
                return chain;
            });
        });
    }

    /** The roles mapped to each projected group, keeping only groups mapped to one of {@code roles} (null: all). */
    private static Map<String, Set<String>> projectedGroups(List<IamGroupRole> rows, Collection<String> roles) {
        Map<String, Set<String>> rolesByGroup = new TreeMap<>();
        for (IamGroupRole row : rows) {
            if (row.projected) {
                rolesByGroup.computeIfAbsent(row.groupId, g -> new TreeSet<>()).add(row.roleKey);
            }
        }
        rolesByGroup.values().removeIf(groupRoles -> roles != null && groupRoles.stream().noneMatch(roles::contains));
        return rolesByGroup;
    }

    /** Queues, for each group, adding the user when active and holding one of its roles, removing otherwise. */
    private static Uni<Void> queueFor(Long rootId, IamUser user, Map<String, Set<String>> rolesByGroup) {
        return heldRoles(rootId, user.id).flatMap(held -> {
            boolean active = "ACTIVE".equals(user.status);
            Uni<Void> queued = Uni.createFrom().voidItem();
            for (Map.Entry<String, Set<String>> group : rolesByGroup.entrySet()) {
                boolean holds = active && group.getValue().stream().anyMatch(held::contains);
                String kind = holds ? IamProjectionChange.MEMBER_ADDED : IamProjectionChange.MEMBER_REMOVED;
                queued = queued.flatMap(q -> queueOnce(rootId, kind, group.getKey(), IamUser.normalize(user.email)));
            }
            return queued;
        });
    }

    /**
     * The members of a team, for changes made through it. Reads ids only: loading the entities would keep them in the
     * session, and replacing the team's members re-creates rows with the same ids.
     */
    public static Uni<List<UUID>> teamMembers(UUID teamId) {
        return Panache.getSession().flatMap(session -> session
                .createQuery("select m.id.userId from IamTeamMember m where m.id.teamId = ?1", UUID.class)
                .setParameter(1, teamId)
                .getResultList());
    }

    /** Role keys the user holds on the whole organization now, directly or through a team. */
    private static Uni<Set<String>> heldRoles(Long rootId, UUID userId) {
        Instant now = Instant.now();
        return IamRoleBinding.findFor(List.of(rootId), IamRoleBinding.USER, List.of(userId.toString()))
                .flatMap(own -> IamTeamMember.findByUser(userId).flatMap(memberships -> {
                    List<String> teamIds = memberships.stream().map(m -> m.id.teamId.toString()).toList();
                    return IamRoleBinding.findFor(List.of(rootId), IamRoleBinding.TEAM, teamIds).map(teams -> {
                        List<IamRoleBinding> all = new ArrayList<>(own);
                        all.addAll(teams);
                        Set<String> held = new TreeSet<>();
                        all.stream().filter(b -> b.organizationWide(now)).forEach(b -> held.add(b.roleKey));
                        return held;
                    });
                }));
    }

    /** Queues the change unless the newest pending change for the person and group already is the same. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    static Uni<Void> queueOnce(Long organizationId, String kind, String groupId, String email) {
        return IamProjectionChange.findLastPending(organizationId, groupId, email)
                .flatMap(last -> last != null && kind.equals(last.kind)
                        ? Uni.createFrom().voidItem()
                        : IamProjectionChange.of(organizationId, kind, groupId, email).persist().replaceWithVoid());
    }
}
