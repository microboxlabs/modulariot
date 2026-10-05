package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamInvitation;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.LockModeType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Members and invitations of an organization. Members belong to the top-level organization; a sub-account shares its
 * parent's. Endpoints check the permission first; this service applies {@link TeamRules} with the actor's access.
 */
@ApplicationScoped
public class TeamService {

    static final Duration DEFAULT_INVITATION_TTL = Duration.ofDays(30);
    static final int MAX_INVITATION_DAYS = 90;
    private static final SecureRandom RANDOM = new SecureRandom();

    public record MemberView(UUID userId, String email, String name, String baseRole, String status, String source,
            List<String> roles, Instant joinedAt, Instant lastSeenAt) {
    }

    public record TeamView(String organization, String membershipSource, List<MemberView> members) {
    }

    public record InvitationView(UUID id, String email, String baseRole, List<String> roles, String invitedBy,
            Instant createdAt, Instant expiresAt, boolean expired, String organization) {
    }

    /** {@code token} is returned once; the app builds the link from it. */
    public record CreatedInvitation(InvitationView invitation, String token) {
    }

    /** The organization joined (its slug) and the new membership. */
    public record AcceptedInvitation(String organization, MemberView member) {
    }

    public record InviteRequest(List<String> emails, String baseRole, List<String> roles, Integer expiresInDays) {
    }

    public record BaseRoleRequest(String baseRole) {
    }

    public record RolesRequest(List<String> roles) {
    }

    private final AccessEvaluator evaluator;
    private final IamDirectory directory;
    private final AlfrescoBridge bridge;

    @Inject
    public TeamService(AccessEvaluator evaluator, IamDirectory directory, AlfrescoBridge bridge) {
        this.evaluator = evaluator;
        this.directory = directory;
        this.bridge = bridge;
    }

    // --- members ---

    public Uni<TeamView> members(String slug) {
        return Panache.withSession(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                IamMembership.findByOrganization(root.id).flatMap(rows -> views(root.id, rows))
                        .map(members -> new TeamView(org.slug,
                                evaluator.isNative(root) ? "NATIVE" : "ALFRESCO", members)))));
    }

    public Uni<MemberView> setBaseRole(String slug, Caller actor, UUID userId, BaseRoleRequest request) {
        BaseRole next = baseRole(request == null ? null : request.baseRole());
        return Panache.withTransaction(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                evaluator.evaluate(org, actor).flatMap(access -> membership(root.id, userId).flatMap(m ->
                        lockedOwnerCount(root.id).flatMap(owners -> {
                            BaseRole current = BaseRole.valueOf(m.baseRole);
                            TeamRules.checkBaseRoleChange(access, current, next, owners);
                            m.baseRole = next.name();
                            return m.<IamMembership>persist()
                                    .flatMap(saved -> directory.audit(root.id, actor.name(), "member.role",
                                            userId.toString(), Map.of("from", current.name(), "to", next.name())))
                                    .flatMap(ignored -> view(root.id, m));
                        }))))));
    }

    public Uni<MemberView> setRoles(String slug, Caller actor, UUID userId, RolesRequest request) {
        Set<String> wanted = new TreeSet<>(request == null || request.roles() == null ? List.of() : request.roles());
        return Panache.withTransaction(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                evaluator.evaluate(org, actor).flatMap(access -> membership(root.id, userId).flatMap(m -> {
                    TeamRules.checkGrant(access, wanted, evaluator.registry());
                    return replaceRoles(root.id, userId, wanted, actor.name())
                            .flatMap(ignored -> view(root.id, m));
                })))));
    }

    public Uni<Void> remove(String slug, Caller actor, UUID userId) {
        return Panache.withTransaction(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                evaluator.evaluate(org, actor).flatMap(access -> membership(root.id, userId).flatMap(m ->
                        lockedOwnerCount(root.id).flatMap(owners -> {
                            TeamRules.checkRemoval(access, BaseRole.valueOf(m.baseRole), owners);
                            return IamRoleBinding.delete("organizationId = ?1 and principalKind = ?2 "
                                            + "and principalId = ?3", root.id, IamRoleBinding.USER, userId.toString())
                                    .flatMap(ignored -> m.delete())
                                    .flatMap(ignored -> IamUser.<IamUser>findById(userId))
                                    .flatMap(user -> user == null
                                            ? Uni.createFrom().voidItem()
                                            : bridge.memberRemoved(root.id, user.email))
                                    .flatMap(ignored -> directory.audit(root.id, actor.name(), "member.removed",
                                            userId.toString(), Map.of("baseRole", m.baseRole)));
                        }))))));
    }

    // --- invitations ---

    public Uni<List<InvitationView>> invitations(String slug) {
        return Panache.withSession(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                IamInvitation.pendingFor(root.id)
                        .map(rows -> rows.stream().map(i -> view(i, root.slug)).toList()))));
    }

    public Uni<List<CreatedInvitation>> invite(String slug, Caller actor, InviteRequest request) {
        if (request == null || request.emails() == null || request.emails().isEmpty()) {
            throw new IllegalArgumentException("emails is required");
        }
        BaseRole base = request.baseRole() == null ? BaseRole.MEMBER : baseRole(request.baseRole());
        Set<String> roles = new TreeSet<>(request.roles() == null ? List.of() : request.roles());
        Duration ttl = ttl(request.expiresInDays());
        Set<String> emails = new LinkedHashSet<>();
        for (String email : request.emails()) {
            String normalized = IamUser.normalize(email);
            if (normalized == null || !normalized.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
                throw new IllegalArgumentException("Not an email: " + email);
            }
            emails.add(normalized);
        }
        return Panache.withTransaction(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                evaluator.evaluate(org, actor).flatMap(access -> {
                    TeamRules.checkInvite(access, base, roles, evaluator.registry());
                    Uni<List<CreatedInvitation>> chain = Uni.createFrom().item(new ArrayList<>());
                    for (String email : emails) {
                        chain = chain.flatMap(list -> inviteOne(root, email, base, roles, ttl, actor.name())
                                .map(created -> {
                                    list.add(created);
                                    return list;
                                }));
                    }
                    return chain;
                }))));
    }

    public Uni<CreatedInvitation> resend(String slug, Caller actor, UUID invitationId) {
        return Panache.withTransaction(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                invitation(root.id, invitationId).flatMap(invitation -> {
                    String token = newToken();
                    invitation.tokenHash = hash(token);
                    invitation.expiresAt = Instant.now().plus(DEFAULT_INVITATION_TTL);
                    invitation.updatedAt = Instant.now();
                    return invitation.<IamInvitation>persist()
                            .flatMap(saved -> directory.audit(root.id, actor.name(), "invitation.resent",
                                    saved.email, Map.of()))
                            .map(ignored -> new CreatedInvitation(view(invitation, root.slug), token));
                }))));
    }

    public Uni<Void> revoke(String slug, Caller actor, UUID invitationId) {
        return Panache.withTransaction(() -> organization(slug).flatMap(org -> root(org).flatMap(root ->
                invitation(root.id, invitationId).flatMap(invitation -> {
                    invitation.status = IamInvitation.REVOKED;
                    invitation.updatedAt = Instant.now();
                    return invitation.<IamInvitation>persist()
                            .flatMap(saved -> directory.audit(root.id, actor.name(), "invitation.revoked",
                                    saved.email, Map.of()));
                }))));
    }

    /** The caller's open invitations, in any organization. */
    public Uni<List<InvitationView>> mine(String email) {
        String me = IamUser.normalize(email);
        return Panache.withSession(() -> IamInvitation.pendingForEmail(me).flatMap(rows -> {
            Uni<List<InvitationView>> chain = Uni.createFrom().item(new ArrayList<>());
            Instant now = Instant.now();
            for (IamInvitation i : rows) {
                if (!i.open(now)) {
                    continue;
                }
                chain = chain.flatMap(list -> Organization.<Organization>findById(i.organizationId).map(org -> {
                    if (org != null && org.active) {
                        list.add(view(i, org.slug));
                    }
                    return list;
                }));
            }
            return chain;
        }));
    }

    /** Accepts by token: the signed-in user's email must be the invited one. */
    public Uni<AcceptedInvitation> acceptToken(String token, String email, String subject, String name) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("token is required");
        }
        return Panache.withTransaction(() -> IamInvitation.byTokenHash(hash(token.trim()))
                .flatMap(invitation -> accept(invitation, email, subject, name)));
    }

    /** Accepts one of the caller's own invitations, found by email after sign-in. */
    public Uni<AcceptedInvitation> acceptMine(UUID invitationId, String email, String subject, String name) {
        return Panache.withTransaction(() -> IamInvitation.<IamInvitation>findById(invitationId)
                .flatMap(invitation -> accept(invitation, email, subject, name)));
    }

    private Uni<AcceptedInvitation> accept(IamInvitation invitation, String email, String subject, String name) {
        Instant now = Instant.now();
        if (invitation == null || !invitation.open(now)) {
            throw new NoSuchElementException("Invitation not found or expired");
        }
        String me = IamUser.normalize(email);
        if (me == null || !me.equals(IamUser.normalize(invitation.email))) {
            throw new SecurityException("This invitation is for another email");
        }
        return IamUser.findOrCreate(me).flatMap(user -> {
            if (subject != null && user.subject == null) {
                user.subject = subject;
            }
            if (name != null && !name.isBlank()) {
                user.name = name;
            }
            user.lastSeenAt = now;
            return user.<IamUser>persist();
        }).flatMap(user -> IamMembership.findOne(invitation.organizationId, user.id).flatMap(existing -> {
            BaseRole invited = BaseRole.valueOf(invitation.baseRole);
            IamMembership m = existing != null
                    ? existing
                    : IamMembership.of(invitation.organizationId, user.id, invited.name(), "INVITE",
                            invitation.invitedBy);
            m.baseRole = BaseRole.max(BaseRole.valueOf(m.baseRole), invited).name();
            m.status = "ACTIVE";
            return m.<IamMembership>persist()
                    .flatMap(saved -> existing == null
                            ? bridge.memberAdded(invitation.organizationId, me)
                            : Uni.createFrom().voidItem())
                    .flatMap(saved -> addRoles(invitation.organizationId, user.id, invitation.roles(), me))
                    .flatMap(ignored -> {
                        invitation.status = IamInvitation.ACCEPTED;
                        invitation.acceptedBy = user.id;
                        invitation.updatedAt = now;
                        return invitation.<IamInvitation>persist();
                    })
                    .flatMap(ignored -> directory.audit(invitation.organizationId, me, "invitation.accepted", me,
                            Map.of("baseRole", m.baseRole, "roles", invitation.roles())))
                    .flatMap(ignored -> view(invitation.organizationId, m))
                    .flatMap(member -> Organization.<Organization>findById(invitation.organizationId)
                            .map(org -> new AcceptedInvitation(org == null ? null : org.slug, member)));
        }));
    }

    // --- helpers ---

    private Uni<CreatedInvitation> inviteOne(Organization root, String email, BaseRole base, Set<String> roles,
            Duration ttl, String actor) {
        return IamUser.findByEmail(email)
                .flatMap(user -> user == null
                        ? Uni.createFrom().nullItem()
                        : IamMembership.findOne(root.id, user.id))
                .flatMap(member -> {
                    if (member != null) {
                        throw new IllegalStateException(email + " is already a member");
                    }
                    return IamInvitation.pendingFor(root.id, email);
                })
                .flatMap(pending -> {
                    String token = newToken();
                    IamInvitation invitation = pending != null ? pending : new IamInvitation();
                    if (pending == null) {
                        invitation.id = UUID.randomUUID();
                        invitation.organizationId = root.id;
                        invitation.email = email;
                    }
                    invitation.baseRole = base.name();
                    invitation.roles(roles);
                    invitation.tokenHash = hash(token);
                    invitation.expiresAt = Instant.now().plus(ttl);
                    invitation.invitedBy = actor;
                    invitation.updatedAt = Instant.now();
                    return invitation.<IamInvitation>persist()
                            .flatMap(saved -> directory.audit(root.id, actor, "invitation.created", email,
                                    Map.of("baseRole", base.name(), "roles", List.copyOf(roles))))
                            .map(ignored -> new CreatedInvitation(view(invitation, root.slug), token));
                });
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<Void> replaceRoles(Long orgId, UUID userId, Set<String> wanted, String actor) {
        return IamRoleBinding.delete("organizationId = ?1 and principalKind = ?2 and principalId = ?3 "
                        + "and scopeKind = ?4", orgId, IamRoleBinding.USER, userId.toString(),
                        IamRoleBinding.ORGANIZATION)
                .flatMap(ignored -> addRoles(orgId, userId, List.copyOf(wanted), actor))
                .flatMap(ignored -> directory.audit(orgId, actor, "member.roles", userId.toString(),
                        Map.of("roles", List.copyOf(wanted))));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<Void> addRoles(Long orgId, UUID userId, List<String> roles, String actor) {
        return IamRoleBinding.findFor(List.of(orgId), IamRoleBinding.USER, List.of(userId.toString()))
                .flatMap(existing -> {
                    Set<String> held = new TreeSet<>();
                    existing.stream().filter(b -> IamRoleBinding.ORGANIZATION.equals(b.scopeKind))
                            .forEach(b -> held.add(b.roleKey));
                    Uni<Void> chain = Uni.createFrom().voidItem();
                    for (String role : roles) {
                        if (held.add(role)) {
                            chain = chain.flatMap(i -> IamRoleBinding.of(orgId, IamRoleBinding.USER,
                                    userId.toString(), role, actor).persist().replaceWithVoid());
                        }
                    }
                    return chain;
                });
    }

    private Uni<List<MemberView>> views(Long orgId, List<IamMembership> rows) {
        List<UUID> ids = rows.stream().map(m -> m.userId).toList();
        Instant now = Instant.now();
        return IamUser.findByIds(ids).flatMap(users -> IamRoleBinding.findByOrganization(orgId).map(bindings -> {
            List<MemberView> out = new ArrayList<>();
            for (IamMembership m : rows) {
                IamUser u = users.stream().filter(x -> x.id.equals(m.userId)).findFirst().orElse(null);
                List<String> roles = bindings.stream()
                        .filter(b -> IamRoleBinding.USER.equals(b.principalKind)
                                && b.principalId.equals(m.userId.toString()) && b.organizationWide(now))
                        .map(b -> b.roleKey).sorted().toList();
                out.add(view(m, u, roles));
            }
            out.sort((a, b) -> String.valueOf(a.email()).compareTo(String.valueOf(b.email())));
            return out;
        }));
    }

    private Uni<MemberView> view(Long orgId, IamMembership m) {
        return views(orgId, List.of(m)).map(list -> list.get(0));
    }

    private static MemberView view(IamMembership m, IamUser u, List<String> roles) {
        return new MemberView(m.userId, u == null ? null : u.email, u == null ? null : u.name, m.baseRole, m.status,
                m.source, roles, m.createdAt, u == null ? null : u.lastSeenAt);
    }

    static InvitationView view(IamInvitation i, String organization) {
        return new InvitationView(i.id, i.email, i.baseRole, i.roles(), i.invitedBy, i.createdAt, i.expiresAt,
                !i.expiresAt.isAfter(Instant.now()), organization);
    }

    private static Uni<Organization> organization(String slug) {
        return Organization.findBySlug(slug).map(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            return org;
        });
    }

    private static Uni<Organization> root(Organization org) {
        return org.parent == null ? Uni.createFrom().item(org) : Organization.<Organization>findById(org.parent.id);
    }

    private static Uni<IamMembership> membership(Long orgId, UUID userId) {
        return IamMembership.findOne(orgId, userId).map(m -> {
            if (m == null) {
                throw new NoSuchElementException("Member not found");
            }
            return m;
        });
    }

    private static Uni<IamInvitation> invitation(Long orgId, UUID id) {
        return IamInvitation.<IamInvitation>findById(id).map(i -> {
            if (i == null || !i.organizationId.equals(orgId) || !IamInvitation.PENDING.equals(i.status)) {
                throw new NoSuchElementException("Invitation not found");
            }
            return i;
        });
    }

    /**
     * Locks the organization row, then counts owners, so two concurrent demotions cannot both see a second owner.
     */
    @SuppressWarnings("java:S3252") // Reactive Panache generates findById per entity.
    private static Uni<Long> lockedOwnerCount(Long orgId) {
        return Organization.<Organization>findById(orgId, LockModeType.PESSIMISTIC_WRITE)
                .flatMap(locked -> ownerCount(orgId));
    }

    private static Uni<Long> ownerCount(Long orgId) {
        return IamMembership.findByRole(orgId, BaseRole.OWNER.name()).map(list -> (long) list.size());
    }

    static BaseRole baseRole(String value) {
        if (value == null) {
            throw new IllegalArgumentException("baseRole is required");
        }
        try {
            return BaseRole.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("baseRole must be OWNER, ADMIN or MEMBER");
        }
    }

    static Duration ttl(Integer days) {
        if (days == null) {
            return DEFAULT_INVITATION_TTL;
        }
        if (days < 1 || days > MAX_INVITATION_DAYS) {
            throw new IllegalArgumentException("expiresInDays must be 1-" + MAX_INVITATION_DAYS);
        }
        return Duration.ofDays(days);
    }

    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
