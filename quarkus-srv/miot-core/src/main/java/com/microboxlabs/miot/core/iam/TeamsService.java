package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamServiceAccount;
import com.microboxlabs.miot.core.iam.model.IamTeam;
import com.microboxlabs.miot.core.iam.model.IamTeamMember;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

/**
 * Teams, and role bindings on any principal and scope. A binding on a team grants its role to every member of the
 * team; a binding scoped to a sub-account applies to that sub-account only.
 */
@ApplicationScoped
public class TeamsService {

    public record TeamView(UUID id, String name, String description, String source, List<UUID> members,
            List<String> roles, Instant createdAt) {
    }

    public record TeamRequest(String name, String description) {
    }

    public record TeamMembersRequest(List<UUID> userIds) {
    }

    public record BindingView(UUID id, String principalKind, String principalId, String role, String scopeKind,
            String subAccount, Instant expiresAt, Instant createdAt, String createdBy) {
    }

    /** {@code subAccount} is a sub-account's slug; null for the whole organization. */
    public record BindingRequest(String principalKind, String principalId, String role, String subAccount,
            Instant expiresAt) {
    }

    private final AccessEvaluator evaluator;
    private final IamDirectory directory;

    @Inject
    public TeamsService(AccessEvaluator evaluator, IamDirectory directory) {
        this.evaluator = evaluator;
        this.directory = directory;
    }

    // --- teams ---

    public Uni<List<TeamView>> teams(String slug) {
        return Panache.withSession(() -> root(slug).flatMap(root -> IamTeam.findByOrganization(root.id)
                .flatMap(teams -> views(root.id, teams))));
    }

    public Uni<TeamView> create(String slug, Caller actor, TeamRequest request) {
        String name = name(request);
        return Panache.withTransaction(() -> root(slug).flatMap(root -> {
            IamTeam team = new IamTeam();
            team.id = UUID.randomUUID();
            team.organizationId = root.id;
            team.name = name;
            team.description = request.description();
            team.createdBy = actor.name();
            return team.<IamTeam>persist()
                    .flatMap(saved -> directory.audit(root.id, actor.name(), "team.created", name, Map.of()))
                    .flatMap(ignored -> view(root.id, team));
        }));
    }

    public Uni<TeamView> update(String slug, Caller actor, UUID teamId, TeamRequest request) {
        String name = name(request);
        return Panache.withTransaction(() -> root(slug).flatMap(root -> team(root.id, teamId).flatMap(team -> {
            team.name = name;
            team.description = request.description();
            return team.<IamTeam>persist()
                    .flatMap(saved -> directory.audit(root.id, actor.name(), "team.updated", name, Map.of()))
                    .flatMap(ignored -> view(root.id, team));
        })));
    }

    public Uni<Void> delete(String slug, Caller actor, UUID teamId) {
        return Panache.withTransaction(() -> root(slug).flatMap(root -> team(root.id, teamId)
                .flatMap(team -> IamRoleBinding.delete("organizationId = ?1 and principalKind = ?2 "
                                + "and principalId = ?3", root.id, IamRoleBinding.TEAM, team.id.toString())
                        .flatMap(ignored -> team.delete())
                        .flatMap(ignored -> directory.audit(root.id, actor.name(), "team.deleted", team.name,
                                Map.of())))));
    }

    /** Replaces the team's members. Every one must be a member of the organization. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<TeamView> setMembers(String slug, Caller actor, UUID teamId, TeamMembersRequest request) {
        Set<UUID> wanted = new LinkedHashSet<>(request == null || request.userIds() == null
                ? List.of() : request.userIds());
        return Panache.withTransaction(() -> root(slug).flatMap(root -> team(root.id, teamId).flatMap(team ->
                IamMembership.findByOrganization(root.id).flatMap(memberships -> {
                    Set<UUID> members = new HashSet<>();
                    memberships.forEach(m -> members.add(m.userId));
                    for (UUID id : wanted) {
                        if (!members.contains(id)) {
                            throw new IllegalArgumentException("Not a member of the organization: " + id);
                        }
                    }
                    return IamTeamMember.delete("id.teamId = ?1", team.id).flatMap(ignored -> {
                        Uni<Void> chain = Uni.createFrom().voidItem();
                        for (UUID id : wanted) {
                            chain = chain.flatMap(i -> new IamTeamMember(team.id, id).persist().replaceWithVoid());
                        }
                        return chain;
                    }).flatMap(ignored -> directory.audit(root.id, actor.name(), "team.members", team.name,
                            Map.of("members", wanted.stream().map(UUID::toString).toList())))
                            .flatMap(ignored -> view(root.id, team));
                }))));
    }

    // --- bindings ---

    public Uni<List<BindingView>> bindings(String slug) {
        return Panache.withSession(() -> root(slug).flatMap(root -> IamRoleBinding.findByOrganization(root.id)
                .flatMap(bindings -> Organization.findByParent(root.id).map(children -> {
                    List<BindingView> out = new ArrayList<>();
                    for (IamRoleBinding b : bindings) {
                        String sub = IamRoleBinding.SUB_ACCOUNT.equals(b.scopeKind)
                                ? children.stream().filter(c -> String.valueOf(c.id).equals(b.scopeId))
                                        .map(c -> c.slug).findFirst().orElse(b.scopeId)
                                : null;
                        out.add(new BindingView(b.id, b.principalKind, b.principalId, b.roleKey, b.scopeKind, sub,
                                b.expiresAt, b.createdAt, b.createdBy));
                    }
                    return out;
                }))));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<BindingView> bind(String slug, Caller actor, BindingRequest request) {
        if (request == null || request.principalKind() == null || request.principalId() == null
                || request.role() == null) {
            throw new IllegalArgumentException("principalKind, principalId and role are required");
        }
        String kind = request.principalKind().trim().toUpperCase(Locale.ROOT);
        if (!Set.of(IamRoleBinding.USER, IamRoleBinding.TEAM, IamRoleBinding.SERVICE_ACCOUNT).contains(kind)) {
            throw new IllegalArgumentException("principalKind must be USER, TEAM or SERVICE_ACCOUNT");
        }
        UUID principal = uuid(request.principalId());
        return Panache.withTransaction(() -> root(slug).flatMap(root -> evaluator.evaluate(slug, actor)
                .flatMap(access -> {
                    TeamRules.checkGrant(access, List.of(request.role()), evaluator.registry());
                    return principalExists(root.id, kind, principal)
                            .flatMap(ignored -> subAccount(root, request.subAccount()))
                            .flatMap(sub -> {
                                IamRoleBinding b = IamRoleBinding.of(root.id, kind, principal.toString(),
                                        request.role(), actor.name());
                                if (sub != null) {
                                    b.scopeKind = IamRoleBinding.SUB_ACCOUNT;
                                    b.scopeId = String.valueOf(sub.id);
                                }
                                b.expiresAt = request.expiresAt();
                                return b.<IamRoleBinding>persist()
                                        .flatMap(saved -> directory.audit(root.id, actor.name(), "binding.created",
                                                kind + ":" + principal, Map.of("role", request.role(),
                                                        "subAccount", sub == null ? "" : sub.slug)))
                                        .map(ignored -> new BindingView(b.id, b.principalKind, b.principalId,
                                                b.roleKey, b.scopeKind, sub == null ? null : sub.slug, b.expiresAt,
                                                b.createdAt, b.createdBy));
                            });
                })));
    }

    public Uni<Void> unbind(String slug, Caller actor, UUID bindingId) {
        return Panache.withTransaction(() -> root(slug).flatMap(root -> IamRoleBinding.<IamRoleBinding>findById(
                bindingId).flatMap(b -> {
                    if (b == null || !b.organizationId.equals(root.id)) {
                        throw new NoSuchElementException("Binding not found");
                    }
                    return b.delete().flatMap(ignored -> directory.audit(root.id, actor.name(), "binding.deleted",
                            b.principalKind + ":" + b.principalId, Map.of("role", b.roleKey)));
                })));
    }

    // --- helpers ---

    private Uni<List<TeamView>> views(Long orgId, List<IamTeam> teams) {
        List<UUID> ids = teams.stream().map(t -> t.id).toList();
        return IamTeamMember.findByTeams(ids).flatMap(members -> IamRoleBinding.findByOrganization(orgId)
                .map(bindings -> teams.stream().map(t -> new TeamView(t.id, t.name, t.description, t.source,
                        members.stream().filter(m -> m.id.teamId.equals(t.id)).map(m -> m.id.userId).toList(),
                        bindings.stream().filter(b -> IamRoleBinding.TEAM.equals(b.principalKind)
                                && b.principalId.equals(t.id.toString())).map(b -> b.roleKey).sorted().toList(),
                        t.createdAt)).toList()));
    }

    private Uni<TeamView> view(Long orgId, IamTeam team) {
        return views(orgId, List.of(team)).map(list -> list.get(0));
    }

    private static Uni<Void> principalExists(Long orgId, String kind, UUID id) {
        Uni<Boolean> exists = switch (kind) {
            case IamRoleBinding.USER -> IamMembership.findOne(orgId, id).map(m -> m != null);
            case IamRoleBinding.TEAM -> IamTeam.findOne(orgId, id).map(t -> t != null);
            default -> IamServiceAccount.findOne(orgId, id).map(a -> a != null);
        };
        return exists.map(found -> {
            if (!Boolean.TRUE.equals(found)) {
                throw new NoSuchElementException(kind + " not found in the organization: " + id);
            }
            return null;
        });
    }

    private static Uni<Organization> subAccount(Organization root, String slug) {
        if (slug == null || slug.isBlank()) {
            return Uni.createFrom().nullItem();
        }
        return Organization.findBySlug(slug.trim()).map(sub -> {
            if (sub == null || sub.parent == null || !sub.parent.id.equals(root.id)) {
                throw new IllegalArgumentException("Not a sub-account of the organization: " + slug);
            }
            return sub;
        });
    }

    private static Uni<Organization> root(String slug) {
        return Organization.findBySlug(slug).flatMap(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            return org.parent == null
                    ? Uni.createFrom().item(org)
                    : Organization.<Organization>findById(org.parent.id);
        });
    }

    private static Uni<IamTeam> team(Long orgId, UUID id) {
        return IamTeam.findOne(orgId, id).map(t -> {
            if (t == null) {
                throw new NoSuchElementException("Team not found");
            }
            return t;
        });
    }

    private static String name(TeamRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        String name = request.name().trim();
        if (name.length() > 120) {
            throw new IllegalArgumentException("name is at most 120 characters");
        }
        return name;
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("principalId must be a uuid");
        }
    }
}
