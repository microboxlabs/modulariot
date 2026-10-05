package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamUser;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.UUID;

/**
 * Writes and reads memberships and role holders. Callers authorize first and run these inside a transaction. A
 * subject is an email (a user) or anything else (an M2M client id).
 */
@ApplicationScoped
public class IamDirectory {

    private final AlfrescoBridge bridge;

    @Inject
    public IamDirectory(AlfrescoBridge bridge) {
        this.bridge = bridge;
    }

    /** The organization's owners' emails, sorted. */
    public Uni<List<String>> owners(Long organizationId) {
        return IamMembership.findByRole(organizationId, BaseRole.OWNER.name()).flatMap(this::emailsOf);
    }

    /** Makes exactly {@code emails} the owners. Previous owners stay members. */
    // Reactive Panache: persist overloads are ambiguous; finders are generated per entity.
    @SuppressWarnings({"java:S1612", "java:S3252"})
    public Uni<Void> setOwners(Long organizationId, Set<String> emails, String actor) {
        Set<String> wanted = normalized(emails);
        return IamMembership.findByRole(organizationId, BaseRole.OWNER.name())
                .flatMap(current -> emailsOf(current).flatMap(currentEmails -> {
                    Uni<Void> chain = Uni.createFrom().voidItem();
                    for (IamMembership m : current) {
                        chain = chain.flatMap(ignored -> IamUser.<IamUser>findById(m.userId).flatMap(user -> {
                            if (user != null && !wanted.contains(user.email)) {
                                m.baseRole = BaseRole.MEMBER.name();
                                return m.<IamMembership>persist().replaceWithVoid();
                            }
                            return Uni.createFrom().voidItem();
                        }));
                    }
                    for (String email : wanted) {
                        chain = chain.flatMap(ignored -> ensureMember(organizationId, email, BaseRole.OWNER, actor)
                                .flatMap(m -> {
                                    m.baseRole = BaseRole.OWNER.name();
                                    return m.<IamMembership>persist().replaceWithVoid();
                                }));
                    }
                    return chain.flatMap(ignored -> audit(organizationId, actor, "owners.replaced", null,
                            Map.of("before", currentEmails, "after", List.copyOf(wanted))));
                }));
    }

    /**
     * The subjects holding {@code roleKey} on the whole organization, sorted: emails for users, ids for clients.
     * Sub-account, resource and expired bindings are left out.
     */
    public Uni<List<String>> holders(Long organizationId, String roleKey) {
        Instant now = Instant.now();
        return IamRoleBinding.findByRole(organizationId, roleKey).flatMap(bindings -> {
            List<UUID> userIds = new ArrayList<>();
            List<String> clients = new ArrayList<>();
            for (IamRoleBinding b : bindings) {
                if (!IamRoleBinding.ORGANIZATION.equals(b.scopeKind)
                        || (b.expiresAt != null && !b.expiresAt.isAfter(now))) {
                    continue;
                }
                if (IamRoleBinding.USER.equals(b.principalKind)) {
                    userIds.add(UUID.fromString(b.principalId));
                } else if (IamRoleBinding.CLIENT.equals(b.principalKind)) {
                    clients.add(b.principalId);
                }
            }
            return IamUser.findByIds(userIds).map(users -> {
                List<String> out = new ArrayList<>(clients);
                users.forEach(u -> out.add(u.email));
                return out.stream().sorted().toList();
            });
        });
    }

    /** Makes exactly {@code subjects} hold {@code roleKey} on the organization. A user gets a membership if needed. */
    // Reactive Panache: persist overloads are ambiguous; finders are generated per entity.
    @SuppressWarnings({"java:S1612", "java:S3252"})
    public Uni<Void> setHolders(Long organizationId, String roleKey, Set<String> requested, String actor) {
        Set<String> subjects = requested.stream()
                .map(subject -> isEmail(subject) ? IamUser.normalize(subject) : subject.trim())
                .collect(Collectors.toCollection(TreeSet::new));
        return holders(organizationId, roleKey).flatMap(before -> IamRoleBinding
                .delete("organizationId = ?1 and roleKey = ?2 and scopeKind = ?3",
                        organizationId, roleKey, IamRoleBinding.ORGANIZATION)
                .flatMap(ignored -> {
                    Uni<Void> chain = Uni.createFrom().voidItem();
                    for (String subject : subjects) {
                        chain = chain.flatMap(i -> bind(organizationId, roleKey, subject, actor));
                    }
                    return chain;
                })
                .flatMap(ignored -> audit(organizationId, actor, "role.replaced", roleKey,
                        Map.of("before", before, "after", subjects.stream().sorted().toList()))));
    }

    /** The membership of the user with this email, created with {@code baseRole} when there is none. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<IamMembership> ensureMember(Long organizationId, String email, BaseRole baseRole, String actor) {
        return IamUser.findOrCreate(email).flatMap(user -> IamMembership.findOne(organizationId, user.id)
                .flatMap(existing -> existing != null
                        ? Uni.createFrom().item(existing)
                        : IamMembership.of(organizationId, user.id, baseRole.name(), "NATIVE", actor)
                                .<IamMembership>persist()
                                .call(created -> bridge.memberAdded(organizationId, user.email))));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<Void> audit(Long organizationId, String actor, String action, String target,
            Map<String, Object> detail) {
        return IamAuditEvent.of(organizationId, actor, action, target, detail).persist().replaceWithVoid();
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<Void> bind(Long organizationId, String roleKey, String subject, String actor) {
        if (!isEmail(subject)) {
            return IamRoleBinding.of(organizationId, IamRoleBinding.CLIENT, subject, roleKey, actor)
                    .persist().replaceWithVoid();
        }
        return ensureMember(organizationId, subject, BaseRole.MEMBER, actor)
                .flatMap(m -> IamRoleBinding.of(organizationId, IamRoleBinding.USER, m.userId.toString(), roleKey,
                        actor).persist().replaceWithVoid());
    }

    private Uni<List<String>> emailsOf(List<IamMembership> memberships) {
        List<UUID> ids = memberships.stream().map(m -> m.userId).toList();
        return IamUser.findByIds(ids).map(users -> users.stream().map(u -> u.email).sorted().toList());
    }

    public static boolean isEmail(String subject) {
        return subject != null && subject.contains("@");
    }

    private static Set<String> normalized(Set<String> emails) {
        return Set.copyOf(emails.stream().map(IamUser::normalize).toList());
    }
}
