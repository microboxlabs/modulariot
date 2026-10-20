package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamGroupRole;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamProjectionChange;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamTeamMember;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Keeps each projected Alfresco group equal to the holders of its mapped roles, through the projection outbox that
 * {@link AlfrescoBridge} sends. Role changes are queued as they happen by {@link ProjectionQueue}; this reconcile runs
 * every 30 minutes for what that does not see: expired bindings and changes made in Alfresco.
 *
 * <p>Roles mapped to the same group are reconciled together. A holder missing from the group is added. A direct member
 * is removed only when the organization knows them (they have a membership, active or not) and they hold none of the
 * group's roles; members through a subgroup are never removed. When a run would remove more than
 * {@value #MAX_REMOVED_SHARE_PERCENT}% of a group (and more than {@value #MIN_REMOVALS_HELD} people), it removes
 * nobody from that group and reports the removals as held.
 */
@ApplicationScoped
public class RoleProjection {

    static final int MAX_REMOVED_SHARE_PERCENT = 25;
    static final int MIN_REMOVALS_HELD = 3;
    private static final Logger LOG = Logger.getLogger(RoleProjection.class);

    /**
     * One projected group: the roles mapped to it, who would be added, and who would be removed. {@code groupMembers}
     * counts nested members too; only direct members can be removed.
     */
    public record Line(String groupId, List<String> roleKeys, int holders, int groupMembers, List<String> add,
            List<String> remove, boolean removalsHeld) {
    }

    public record Result(String organization, boolean dryRun, List<Line> lines) {
    }

    private final boolean projection;
    private final GroupRoles groupRoles;

    @Inject
    public RoleProjection(@ConfigProperty(name = AlfrescoBridge.PROJECTION_PROPERTY, defaultValue = "false")
            boolean projection, GroupRoles groupRoles) {
        this.projection = projection;
        this.groupRoles = groupRoles;
    }

    /** Works out the changes for every projected mapping of the organization and, unless a dry run, queues them. */
    public Uni<Result> reconcile(String slug, boolean dryRun) {
        if (!dryRun && !projection) {
            throw new IllegalStateException("Alfresco projection is off: set " + AlfrescoBridge.PROJECTION_PROPERTY);
        }
        return Panache.withTransaction(() -> groupRoles.root(slug).flatMap(org -> reconcile(org, dryRun)));
    }

    /** Reconciles every organization with a projected mapping. */
    @Scheduled(every = "${miot.iam.alfresco-projection.reconcile-every:30m}", delayed = "1m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> reconcileAll() {
        if (!projection) {
            return Uni.createFrom().voidItem();
        }
        return Panache.withSession(IamGroupRole::findProjected).flatMap(rows -> {
            Set<Long> orgIds = rows.stream().map(r -> r.organizationId).collect(Collectors.toCollection(TreeSet::new));
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (Long orgId : orgIds) {
                chain = chain.flatMap(i -> Panache.withTransaction(() -> Organization.<Organization>findById(orgId)
                                .flatMap(org -> org == null ? Uni.createFrom().nullItem() : reconcile(org, false)))
                        .onFailure().invoke(e -> LOG.warnf("Role projection for organization %d failed: %s", orgId,
                                e.getMessage()))
                        .onFailure().recoverWithNull()
                        .replaceWithVoid());
            }
            return chain;
        });
    }

    private Uni<Result> reconcile(Organization org, boolean dryRun) {
        return IamGroupRole.findByOrganization(org.id).flatMap(rows -> IamMembership.findByOrganization(org.id)
                .flatMap(memberships -> emails(memberships.stream().map(m -> m.userId).toList(), false))
                .flatMap(known -> {
                    Map<String, List<String>> rolesByGroup = new TreeMap<>();
                    for (IamGroupRole row : rows) {
                        if (row.projected) {
                            rolesByGroup.computeIfAbsent(row.groupId, g -> new ArrayList<>()).add(row.roleKey);
                        }
                    }
                    Uni<List<Line>> chain = Uni.createFrom().item(new ArrayList<>());
                    for (Map.Entry<String, List<String>> group : rolesByGroup.entrySet()) {
                        chain = chain.flatMap(lines -> line(org, group.getKey(), group.getValue(), known, dryRun)
                                .map(line -> {
                                    lines.add(line);
                                    return lines;
                                }));
                    }
                    return chain.map(lines -> new Result(org.slug, dryRun, List.copyOf(lines)));
                }));
    }

    /**
     * Holders of any role mapped to the group are added when missing. A direct member who holds none of them and is
     * known to the organization is removed; people in the group only through a subgroup are left alone.
     */
    private Uni<Line> line(Organization org, String groupId, List<String> roleKeys, Set<String> known,
            boolean dryRun) {
        return holders(org.id, roleKeys).flatMap(holders -> groupRoles.members(groupId)
                .flatMap(people -> groupRoles.directMembers(groupId).flatMap(direct -> {
                    Set<String> inGroup = people.stream().map(GroupRoles::emailOf).filter(e -> e != null)
                            .collect(Collectors.toCollection(TreeSet::new));
                    List<String> add = holders.stream().filter(e -> !inGroup.contains(e)).toList();
                    List<String> remove = direct == null ? List.of() : inGroup.stream()
                            .filter(e -> direct.contains(e) && !holders.contains(e) && known.contains(e)).toList();
                    boolean held = removalsHeld(remove.size(), inGroup.size());
                    if (held) {
                        LOG.warnf("Role projection held %d removals from %s in %s", remove.size(), groupId,
                                org.slug);
                    }
                    Line line = new Line(groupId, List.copyOf(roleKeys), holders.size(), inGroup.size(), add,
                            remove, held);
                    return dryRun ? Uni.createFrom().item(line) : queue(org.id, line).replaceWith(line);
                })));
    }

    static boolean removalsHeld(int removals, int groupMembers) {
        return removals > MIN_REMOVALS_HELD && removals * 100 > groupMembers * MAX_REMOVED_SHARE_PERCENT;
    }

    private static Uni<Void> queue(Long organizationId, Line line) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String email : line.add()) {
            chain = chain.flatMap(i -> ProjectionQueue.queueOnce(organizationId, IamProjectionChange.MEMBER_ADDED,
                    line.groupId(), email));
        }
        if (!line.removalsHeld()) {
            for (String email : line.remove()) {
                chain = chain.flatMap(i -> ProjectionQueue.queueOnce(organizationId, IamProjectionChange.MEMBER_REMOVED,
                        line.groupId(), email));
            }
        }
        return chain;
    }

    /** Emails of the active users holding the role on the organization, directly or through a team. */
    private static Uni<Set<String>> holders(Long organizationId, List<String> roleKeys) {
        Instant now = Instant.now();
        return IamRoleBinding.findByRoles(organizationId, roleKeys).flatMap(bindings -> {
            List<IamRoleBinding> current = bindings.stream().filter(b -> b.organizationWide(now)).toList();
            List<UUID> users = current.stream().filter(b -> IamRoleBinding.USER.equals(b.principalKind))
                    .map(b -> UUID.fromString(b.principalId)).toList();
            List<UUID> teams = current.stream().filter(b -> IamRoleBinding.TEAM.equals(b.principalKind))
                    .map(b -> UUID.fromString(b.principalId)).toList();
            return IamTeamMember.findByTeams(teams).flatMap(members -> {
                List<UUID> all = new ArrayList<>(users);
                members.forEach(m -> all.add(m.id.userId));
                return emails(all.stream().distinct().toList(), true);
            });
        });
    }

    /** The users' emails; with {@code activeOnly}, only of users who are not disabled. */
    private static Uni<Set<String>> emails(List<UUID> userIds, boolean activeOnly) {
        return IamUser.findByIds(userIds).map(users -> users.stream()
                .filter(u -> !activeOnly || "ACTIVE".equals(u.status))
                .map(u -> IamUser.normalize(u.email))
                .collect(Collectors.toCollection(TreeSet::new)));
    }
}
