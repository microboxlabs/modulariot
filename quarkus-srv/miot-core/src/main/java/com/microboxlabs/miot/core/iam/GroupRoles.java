package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.iam.model.IamGroupRole;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The Alfresco groups that stand for module roles in a top-level organization, and the import that turns their
 * members into role bindings.
 */
@ApplicationScoped
public class GroupRoles {

    /** {@code excludedGroupId}: members of this group are skipped by the import; null for none. */
    public record Mapping(String groupId, String roleKey, boolean projected, String excludedGroupId) {
    }

    /**
     * One mapping's import: members seen, bindings added (or that a dry run would add), bindings already held,
     * members without an email, and members skipped because they are in the excluded group.
     */
    public record ImportLine(String groupId, String roleKey, int seen, int added, int existing, int withoutEmail,
            int excluded) {
    }

    public record ImportResult(String organization, boolean dryRun, List<ImportLine> lines) {
    }

    private final AccessEvaluator evaluator;
    private final IAlfrescoDirectoryClient directory;

    @Inject
    public GroupRoles(AccessEvaluator evaluator, IAlfrescoDirectoryClient directory) {
        this.evaluator = evaluator;
        this.directory = directory;
    }

    public Uni<List<Mapping>> list(String slug) {
        return Panache.withSession(() -> root(slug).flatMap(org -> IamGroupRole.findByOrganization(org.id)))
                .map(rows -> rows.stream().map(r -> new Mapping(r.groupId, r.roleKey, r.projected, r.excludedGroupId))
                        .toList());
    }

    /** Creates or updates the mapping; the role must be a module role this modulith knows. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<Mapping> put(String slug, String groupId, String roleKey, boolean projected, String excludedGroupId,
            String actor) {
        if (!isGroupId(groupId) || (excludedGroupId != null && !isGroupId(excludedGroupId))) {
            throw new IllegalArgumentException("groupId and excludedGroupId must be Alfresco group ids (GROUP_...)");
        }
        if (evaluator.registry().role(roleKey).isEmpty()) {
            throw new IllegalArgumentException("Unknown role: " + roleKey);
        }
        return Panache.withTransaction(() -> root(slug).invoke(org -> {
            if (projected && AlfrescoBridge.isMemberGroup(org, groupId)) {
                throw new IllegalStateException(groupId + " holds the organization's members and cannot be projected");
            }
        }).flatMap(org -> IamGroupRole.findOne(org.id, groupId, roleKey)
                .flatMap(found -> {
                    IamGroupRole row = found == null
                            ? IamGroupRole.of(org.id, groupId, roleKey, projected, excludedGroupId, actor)
                            : found;
                    row.projected = projected;
                    row.excludedGroupId = excludedGroupId;
                    Map<String, Object> detail = new LinkedHashMap<>();
                    detail.put("role", roleKey);
                    detail.put("projected", projected);
                    detail.put("excludedGroupId", excludedGroupId);
                    return row.<IamGroupRole>persist()
                            .flatMap(saved -> IamAuditEvent.of(org.id, actor, "group-role.set", groupId, detail)
                                    .persist())
                            .replaceWith(new Mapping(groupId, roleKey, projected, excludedGroupId));
                })));
    }

    public Uni<Void> delete(String slug, String groupId, String roleKey, String actor) {
        return Panache.withTransaction(() -> root(slug).flatMap(org -> IamGroupRole.findOne(org.id, groupId, roleKey)
                .flatMap(found -> {
                    if (found == null) {
                        throw new NoSuchElementException("No mapping for " + groupId + " and " + roleKey);
                    }
                    return found.delete()
                            .flatMap(i -> IamAuditEvent.of(org.id, actor, "group-role.removed", groupId,
                                    Map.<String, Object>of("role", roleKey)).persist())
                            .replaceWithVoid();
                })));
    }

    /**
     * Gives every member of each mapped group a binding of the mapped role on the top-level organization. Existing
     * bindings are kept. A dry run reports the same counts without writing.
     */
    public Uni<ImportResult> importRoles(String slug, boolean dryRun, String actor) {
        return Panache.withTransaction(() -> root(slug).flatMap(org -> IamGroupRole.findByOrganization(org.id)
                .flatMap(rows -> {
                    Set<String> simulated = new HashSet<>();
                    Uni<List<ImportLine>> chain = Uni.createFrom().item(new ArrayList<>());
                    for (IamGroupRole row : rows) {
                        chain = chain.flatMap(lines -> importOne(org, row, dryRun, simulated, actor).map(line -> {
                            lines.add(line);
                            return lines;
                        }));
                    }
                    return chain.flatMap(lines -> dryRun
                            ? Uni.createFrom().item(new ImportResult(org.slug, true, List.copyOf(lines)))
                            : IamAuditEvent.of(org.id, actor, "group-role.imported", org.slug, summary(lines))
                                    .persist()
                                    .replaceWith(new ImportResult(org.slug, false, List.copyOf(lines))));
                })));
    }

    private Uni<ImportLine> importOne(Organization org, IamGroupRole row, boolean dryRun, Set<String> simulated,
            String actor) {
        Uni<Set<String>> excludedEmails = row.excludedGroupId == null
                ? Uni.createFrom().item(Set.of())
                : members(row.excludedGroupId).map(people -> people.stream().map(GroupRoles::emailOf)
                        .filter(e -> e != null).collect(Collectors.toSet()));
        return excludedEmails.flatMap(excluded -> members(row.groupId).flatMap(people -> {
            int[] counts = new int[4]; // added, existing, without email, excluded
            Set<String> emails = new LinkedHashSet<>();
            for (AlfrescoPerson person : people) {
                String email = emailOf(person);
                if (email == null) {
                    counts[2]++;
                } else if (excluded.contains(email)) {
                    counts[3]++;
                } else {
                    emails.add(email);
                }
            }
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (String email : emails) {
                chain = chain.flatMap(i -> bind(org, email, row.roleKey, dryRun, simulated, actor)
                        .invoke(added -> counts[Boolean.TRUE.equals(added) ? 0 : 1]++)
                        .replaceWithVoid());
            }
            return chain.map(i -> new ImportLine(row.groupId, row.roleKey, people.size(), counts[0], counts[1],
                    counts[2], counts[3]));
        }));
    }

    /**
     * True when the user had no binding of the role on the organization (and, unless a dry run, now has one). A dry
     * run remembers what it would have added in {@code simulated}, so a later mapping counts it as existing.
     */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private static Uni<Boolean> bind(Organization org, String email, String roleKey, boolean dryRun,
            Set<String> simulated, String actor) {
        if (dryRun && !simulated.add(email + "|" + roleKey)) {
            return Uni.createFrom().item(false);
        }
        Uni<IamUser> user = dryRun ? IamUser.findByEmail(email) : IamUser.findOrCreate(email);
        return user.flatMap(u -> {
            if (u == null) {
                return Uni.createFrom().item(true);
            }
            return IamRoleBinding.findFor(List.of(org.id), IamRoleBinding.USER, List.of(u.id.toString()))
                    .flatMap(bindings -> {
                        boolean held = bindings.stream().anyMatch(b -> roleKey.equals(b.roleKey)
                                && IamRoleBinding.ORGANIZATION.equals(b.scopeKind));
                        if (held) {
                            return Uni.createFrom().item(false);
                        }
                        if (dryRun) {
                            return Uni.createFrom().item(true);
                        }
                        return IamRoleBinding.of(org.id, IamRoleBinding.USER, u.id.toString(), roleKey, actor)
                                .persist().replaceWith(true);
                    });
        });
    }

    /** Every person in the group, nested groups included. */
    Uni<List<AlfrescoPerson>> members(String groupId) {
        return directory.listAllGroupMembers(groupId);
    }

    /** The emails of the people who are members of the group themselves; null when the directory cannot tell. */
    Uni<Set<String>> directMembers(String groupId) {
        return directory.listDirectMemberIds(groupId);
    }

    /** The top-level organization of {@code slug}. Needs an open session. */
    Uni<Organization> root(String slug) {
        return Organization.findBySlug(slug).flatMap(found -> {
            if (found == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            return evaluator.root(found);
        });
    }

    private static boolean isGroupId(String id) {
        return id != null && id.startsWith("GROUP_");
    }

    /** The person's email, from the email field or the user id; null when neither is an email. */
    static String emailOf(AlfrescoPerson person) {
        String email = IamUser.normalize(person.email() != null && !person.email().isBlank()
                ? person.email() : person.id());
        return email != null && email.contains("@") ? email : null;
    }

    private static Map<String, Object> summary(List<ImportLine> lines) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (ImportLine line : lines) {
            out.put(line.groupId() + "->" + line.roleKey(), line.added());
        }
        return out;
    }
}
