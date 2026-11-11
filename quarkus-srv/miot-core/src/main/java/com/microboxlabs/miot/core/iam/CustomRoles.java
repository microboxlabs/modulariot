package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamCustomRole;
import com.microboxlabs.miot.core.iam.model.IamInvitation;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * The custom roles of an organization: named sets of catalog permissions that its Owner or Admin defines. They
 * belong to the top-level organization, like members and teams; a sub-account uses its parent's. A custom role is
 * bound like a module role, through {@link TeamService}, {@link TeamsService} and {@link ApiKeyService}.
 */
@ApplicationScoped
@SuppressWarnings("java:S3252") // Reactive Panache generates finders and delete per entity.
public class CustomRoles {

    private static final String ES = "es";
    private static final String EN = "en";
    private static final String PERMISSIONS = "permissions";

    /** How many principals hold the role, counting each once whatever the scope of its bindings. */
    public record Holders(int members, int teams, int serviceAccounts, int clients) {
    }

    public record RoleView(UUID id, String key, Map<String, String> label, Map<String, String> description,
            List<String> permissions, Holders holders, Instant createdAt, String createdBy, Instant updatedAt,
            String updatedBy) {
    }

    /**
     * {@code label.es} is required; {@code label.en} defaults to it. {@code description} is optional per language.
     */
    public record RoleRequest(Map<String, String> label, Map<String, String> description,
            List<String> permissions) {
    }

    /** What deleting the role removed: its bindings, and who held them. */
    public record Deleted(String key, int removedBindings, Holders holders) {
    }

    private record Fields(String nameEs, String nameEn, String descriptionEs, String descriptionEn,
            Set<String> permissions) {
    }

    private final AccessEvaluator evaluator;
    private final IamDirectory directory;

    @Inject
    public CustomRoles(AccessEvaluator evaluator, IamDirectory directory) {
        this.evaluator = evaluator;
        this.directory = directory;
    }

    public Uni<List<RoleView>> list(String slug) {
        return Panache.withSession(() -> organization(slug).flatMap(org -> evaluator.root(org))
                .flatMap(root -> IamCustomRole.findByOrganization(root.id).flatMap(roles -> views(root.id, roles))));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<RoleView> create(String slug, Caller actor, RoleRequest request) {
        return Panache.withTransaction(() -> managed(slug, actor, (root, access) -> {
            Fields fields = fields(request);
            CustomRoleRules.checkAdded(access, fields.permissions(), evaluator.registry());
            return IamCustomRole.findByOrganization(root.id).flatMap(existing -> {
                requireFreeNames(existing, null, fields);
                IamCustomRole role = new IamCustomRole();
                role.id = UUID.randomUUID();
                role.organizationId = root.id;
                role.roleKey = CustomRoleRules.key(fields.nameEs(), existing.stream().map(r -> r.roleKey).toList());
                role.createdBy = actor.name();
                apply(role, fields, actor.name());
                return role.<IamCustomRole>persist()
                        .flatMap(saved -> directory.audit(root.id, actor.name(), "custom-role.created", role.roleKey,
                                Map.of("name", role.nameEs, PERMISSIONS, role.permissions())))
                        .flatMap(ignored -> view(root.id, role));
            });
        }));
    }

    /** Renames the role or changes its permissions. The key stays, so its bindings stay. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<RoleView> update(String slug, Caller actor, UUID roleId, RoleRequest request) {
        return Panache.withTransaction(() -> managed(slug, actor, (root, access) -> {
            Fields fields = fields(request);
            return IamCustomRole.findByOrganization(root.id).flatMap(existing -> {
                IamCustomRole role = existing.stream().filter(r -> r.id.equals(roleId)).findFirst()
                        .orElseThrow(() -> new NoSuchElementException("Custom role not found"));
                requireFreeNames(existing, role.id, fields);
                List<String> before = role.permissions();
                Set<String> added = new TreeSet<>(fields.permissions());
                before.forEach(added::remove);
                CustomRoleRules.checkAdded(access, added, evaluator.registry());
                Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("name", fields.nameEs());
                detail.put("before", before);
                detail.put("after", List.copyOf(fields.permissions()));
                apply(role, fields, actor.name());
                return role.<IamCustomRole>persist()
                        .flatMap(saved -> directory.audit(root.id, actor.name(), "custom-role.updated", role.roleKey,
                                detail))
                        .flatMap(ignored -> view(root.id, role));
            });
        }));
    }

    /**
     * Deletes the role and, in the same transaction, every binding that names it. Pending invitations stop
     * offering it.
     */
    public Uni<Deleted> delete(String slug, Caller actor, UUID roleId) {
        return Panache.withTransaction(() -> managed(slug, actor, (root, access) ->
                IamCustomRole.findOne(root.id, roleId).flatMap(role -> {
                    if (role == null) {
                        throw new NoSuchElementException("Custom role not found");
                    }
                    String key = role.roleKey;
                    return IamRoleBinding.findByRole(root.id, key).flatMap(bindings -> {
                        Holders holders = holders(bindings);
                        Map<String, Object> detail = new LinkedHashMap<>();
                        detail.put("name", role.nameEs);
                        detail.put(PERMISSIONS, role.permissions());
                        detail.put("removedBindings", bindings.size());
                        detail.put("members", holders.members());
                        detail.put("teams", holders.teams());
                        detail.put("serviceAccounts", holders.serviceAccounts());
                        return IamRoleBinding.delete("organizationId = ?1 and roleKey = ?2", root.id, key)
                                .flatMap(ignored -> withoutRole(root.id, key))
                                .flatMap(ignored -> role.delete())
                                .flatMap(ignored -> directory.audit(root.id, actor.name(), "custom-role.deleted",
                                        key, detail))
                                .replaceWith(new Deleted(key, bindings.size(), holders));
                    });
                })));
    }

    private interface Change<T> {
        Uni<T> apply(Organization root, Access access);
    }

    /**
     * Runs a change as an Owner or Admin of the organization, holding the top-level organization's row lock so two
     * changes cannot both take a name or a key.
     */
    private <T> Uni<T> managed(String slug, Caller actor, Change<T> change) {
        return organization(slug).flatMap(org -> evaluator.evaluate(org, actor).flatMap(access -> {
            CustomRoleRules.checkManage(access);
            return evaluator.root(org)
                    .flatMap(root -> Organization.<Organization>findById(root.id, LockModeType.PESSIMISTIC_WRITE))
                    .flatMap(root -> change.apply(root, access));
        }));
    }

    private Fields fields(RoleRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("label and permissions are required");
        }
        Map<String, String> label = request.label() == null ? Map.of() : request.label();
        Map<String, String> description = request.description() == null ? Map.of() : request.description();
        String nameEs = CustomRoleRules.name(label.get(ES), "label.es");
        String en = label.get(EN);
        String nameEn = en == null || en.isBlank() ? nameEs : CustomRoleRules.name(en, "label.en");
        return new Fields(nameEs, nameEn,
                CustomRoleRules.description(description.get(ES), "description.es"),
                CustomRoleRules.description(description.get(EN), "description.en"),
                CustomRoleRules.permissions(request.permissions(), evaluator.registry()));
    }

    private static void apply(IamCustomRole role, Fields fields, String actor) {
        role.nameEs = fields.nameEs();
        role.nameEn = fields.nameEn();
        role.descriptionEs = fields.descriptionEs();
        role.descriptionEn = fields.descriptionEn();
        role.permissions(fields.permissions());
        role.updatedAt = Instant.now();
        role.updatedBy = actor;
    }

    /** A name is free when no other custom role of the organization has it in the same language, ignoring case. */
    private static void requireFreeNames(List<IamCustomRole> existing, UUID self, Fields fields) {
        for (IamCustomRole other : existing) {
            if (other.id.equals(self)) {
                continue;
            }
            if (other.nameEs.equalsIgnoreCase(fields.nameEs())) {
                throw new IllegalStateException("A custom role named " + fields.nameEs() + " already exists");
            }
            if (other.nameEn.equalsIgnoreCase(fields.nameEn())) {
                throw new IllegalStateException("A custom role named " + fields.nameEn() + " already exists");
            }
        }
    }

    /** Takes the role out of the organization's pending invitations, so accepting one cannot bind a deleted role. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private static Uni<Void> withoutRole(Long rootId, String key) {
        return IamInvitation.pendingFor(rootId).flatMap(invitations -> {
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (IamInvitation invitation : invitations) {
                if (invitation.roles().contains(key)) {
                    List<String> kept = new ArrayList<>(invitation.roles());
                    kept.remove(key);
                    invitation.roles(kept);
                    invitation.updatedAt = Instant.now();
                    chain = chain.flatMap(ignored -> invitation.persist().replaceWithVoid());
                }
            }
            return chain;
        });
    }

    private static Uni<List<RoleView>> views(Long rootId, List<IamCustomRole> roles) {
        return IamRoleBinding.findByRoles(rootId, roles.stream().map(r -> r.roleKey).toList())
                .map(bindings -> roles.stream().map(role -> view(role,
                        holders(bindings.stream().filter(b -> b.roleKey.equals(role.roleKey)).toList()))).toList());
    }

    private static Uni<RoleView> view(Long rootId, IamCustomRole role) {
        return views(rootId, List.of(role)).map(List::getFirst);
    }

    private static RoleView view(IamCustomRole role, Holders holders) {
        Map<String, String> description = new LinkedHashMap<>();
        if (role.descriptionEs != null) {
            description.put(ES, role.descriptionEs);
        }
        if (role.descriptionEn != null) {
            description.put(EN, role.descriptionEn);
        }
        return new RoleView(role.id, role.roleKey, Map.of(ES, role.nameEs, EN, role.nameEn), description,
                role.permissions(), holders, role.createdAt, role.createdBy, role.updatedAt, role.updatedBy);
    }

    static Holders holders(List<IamRoleBinding> bindings) {
        return new Holders(distinct(bindings, IamRoleBinding.USER), distinct(bindings, IamRoleBinding.TEAM),
                distinct(bindings, IamRoleBinding.SERVICE_ACCOUNT), distinct(bindings, IamRoleBinding.CLIENT));
    }

    private static int distinct(List<IamRoleBinding> bindings, String kind) {
        Set<String> ids = new HashSet<>();
        bindings.stream().filter(b -> kind.equals(b.principalKind)).forEach(b -> ids.add(b.principalId));
        return ids.size();
    }

    private static Uni<Organization> organization(String slug) {
        return Organization.findBySlug(slug).map(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            return org;
        });
    }
}
