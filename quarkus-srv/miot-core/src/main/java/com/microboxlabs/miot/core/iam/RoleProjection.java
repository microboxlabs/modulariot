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
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Keeps each projected Alfresco group equal to the holders of its mapped role, through the projection outbox that
 * {@link AlfrescoBridge} sends. A holder missing from the group is added. A group member is removed only when the
 * organization knows them (they have a membership) and they no longer hold the role. When a run would remove more
 * than {@value #MAX_REMOVED_SHARE_PERCENT}% of a group (and more than {@value #MIN_REMOVALS_HELD} people), it removes
 * nobody from that group and reports the removals as held.
 */
@ApplicationScoped
public class RoleProjection {

    static final int MAX_REMOVED_SHARE_PERCENT = 25;
    static final int MIN_REMOVALS_HELD = 3;
    private static final Logger LOG = Logger.getLogger(RoleProjection.class);

    /** One projected mapping: who would be added to and removed from the group. */
    public record Line(String groupId, String roleKey, int holders, int groupMembers, List<String> add,
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
    @Scheduled(every = "${miot.iam.alfresco-projection.reconcile-every:10m}", delayed = "1m",
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
                .flatMap(memberships -> emails(memberships.stream().map(m -> m.userId).toList()))
                .flatMap(known -> {
                    Uni<List<Line>> chain = Uni.createFrom().item(new ArrayList<>());
                    for (IamGroupRole row : rows) {
                        if (row.projected) {
                            chain = chain.flatMap(lines -> line(org, row, known, dryRun).map(line -> {
                                lines.add(line);
                                return lines;
                            }));
                        }
                    }
                    return chain.map(lines -> new Result(org.slug, dryRun, List.copyOf(lines)));
                }));
    }

    private Uni<Line> line(Organization org, IamGroupRole row, Set<String> known, boolean dryRun) {
        return holders(org.id, row.roleKey).flatMap(holders -> groupRoles.members(row.groupId).flatMap(people -> {
            Set<String> inGroup = people.stream().map(GroupRoles::emailOf).filter(e -> e != null)
                    .collect(Collectors.toCollection(TreeSet::new));
            List<String> add = holders.stream().filter(e -> !inGroup.contains(e)).toList();
            List<String> remove = inGroup.stream().filter(e -> !holders.contains(e) && known.contains(e)).toList();
            boolean held = removalsHeld(remove.size(), inGroup.size());
            if (held) {
                LOG.warnf("Role projection held %d removals from %s in %s", remove.size(), row.groupId, org.slug);
            }
            Line line = new Line(row.groupId, row.roleKey, holders.size(), inGroup.size(), add, remove, held);
            return dryRun ? Uni.createFrom().item(line) : queue(org.id, line).replaceWith(line);
        }));
    }

    static boolean removalsHeld(int removals, int groupMembers) {
        return removals > MIN_REMOVALS_HELD && removals * 100 > groupMembers * MAX_REMOVED_SHARE_PERCENT;
    }

    private static Uni<Void> queue(Long organizationId, Line line) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String email : line.add()) {
            chain = chain.flatMap(i -> queueOnce(organizationId, IamProjectionChange.MEMBER_ADDED, line.groupId(),
                    email));
        }
        if (!line.removalsHeld()) {
            for (String email : line.remove()) {
                chain = chain.flatMap(i -> queueOnce(organizationId, IamProjectionChange.MEMBER_REMOVED,
                        line.groupId(), email));
            }
        }
        return chain;
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private static Uni<Void> queueOnce(Long organizationId, String kind, String groupId, String email) {
        return IamProjectionChange.findPending(organizationId, kind, groupId, email).flatMap(found -> found != null
                ? Uni.createFrom().voidItem()
                : IamProjectionChange.of(organizationId, kind, groupId, email).persist().replaceWithVoid());
    }

    /** Emails of the active users holding the role on the organization, directly or through a team. */
    private static Uni<Set<String>> holders(Long organizationId, String roleKey) {
        Instant now = Instant.now();
        return IamRoleBinding.findByRole(organizationId, roleKey).flatMap(bindings -> {
            List<IamRoleBinding> current = bindings.stream().filter(b -> b.organizationWide(now)).toList();
            List<UUID> users = current.stream().filter(b -> IamRoleBinding.USER.equals(b.principalKind))
                    .map(b -> UUID.fromString(b.principalId)).toList();
            List<UUID> teams = current.stream().filter(b -> IamRoleBinding.TEAM.equals(b.principalKind))
                    .map(b -> UUID.fromString(b.principalId)).toList();
            return IamTeamMember.findByTeams(teams).flatMap(members -> {
                List<UUID> all = new ArrayList<>(users);
                members.forEach(m -> all.add(m.id.userId));
                return emails(all.stream().distinct().toList());
            });
        });
    }

    private static Uni<Set<String>> emails(List<UUID> userIds) {
        return IamUser.findByIds(userIds).map(users -> users.stream()
                .filter(u -> "ACTIVE".equals(u.status))
                .map(u -> IamUser.normalize(u.email))
                .collect(Collectors.toCollection(TreeSet::new)));
    }
}
