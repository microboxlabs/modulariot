package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamTeamMember;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Moves organizations whose members came from their Alfresco group onto memberships. For each one still marked
 * ALFRESCO: imports the group (see {@link AlfrescoBridge#importMembers}), binds each module's legacy-default role to
 * members who hold no role of that module (what Alfresco membership gave them), then marks it NATIVE.
 *
 * <p>Where {@value #LEGACY_PROPERTY} is {@code native}, membership already came from the modulith, and where
 * {@value #ALFRESCO_AUTH_PROPERTY} is {@code stub} there is no Alfresco to read: organizations are only marked NATIVE.
 * An organization with a sub-account that has its own Alfresco group is left pending: only the top-level group is
 * imported.
 *
 * <p>Runs a second after start and every minute; a failed organization is tried again on the next run. See
 * {@link NativeMembershipReadiness} for how traffic waits for it.
 */
@ApplicationScoped
public class NativeMembershipMigration {

    static final String ACTOR = "native-migration";
    static final String LEGACY_PROPERTY = "miot.organizations.membership";
    static final String ALFRESCO_AUTH_PROPERTY = "miot.alfresco.auth";
    /** Imports from the stub Alfresco clients anyway; for tests. */
    static final String IMPORT_STUB_PROPERTY = "miot.iam.native-migration.import-stub";
    private static final Logger LOG = Logger.getLogger(NativeMembershipMigration.class);

    /** One organization: how many people the import added and suspended, how many default roles were bound. */
    public record Migrated(String organization, int added, int suspended, int defaultsBound, String error) {

        static Migrated failed(String organization, Throwable e) {
            return new Migrated(organization, 0, 0, 0, e.getMessage() == null ? e.toString() : e.getMessage());
        }
    }

    private final AlfrescoBridge bridge;
    private final AccessRegistry registry;
    private final boolean alreadyNative;
    private final boolean scheduled;
    private final AtomicBoolean done = new AtomicBoolean();

    @Inject
    public NativeMembershipMigration(AlfrescoBridge bridge, AccessRegistry registry,
            @ConfigProperty(name = LEGACY_PROPERTY, defaultValue = "alfresco") String legacyMembership,
            @ConfigProperty(name = ALFRESCO_AUTH_PROPERTY, defaultValue = "stub") String alfrescoAuth,
            @ConfigProperty(name = IMPORT_STUB_PROPERTY, defaultValue = "false") boolean importStub,
            @ConfigProperty(name = "miot.iam.native-migration.every", defaultValue = "1m") String every) {
        this.bridge = bridge;
        this.registry = registry;
        this.alreadyNative = "native".equalsIgnoreCase(legacyMembership.trim())
                || ("stub".equalsIgnoreCase(alfrescoAuth.trim()) && !importStub);
        this.scheduled = !"off".equalsIgnoreCase(every.trim());
    }

    @Scheduled(every = "${miot.iam.native-migration.every:1m}", delayed = "1s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> scheduled() {
        return migrateAll().replaceWithVoid();
    }

    /** Whether a run has left no organization behind, or the schedule is off. */
    public boolean settled() {
        return done.get() || !scheduled;
    }

    /** Moves every organization still on Alfresco membership; failures are reported and left for the next run. */
    public Uni<List<Migrated>> migrateAll() {
        return Panache.withSession(Organization::listAlfrescoMembership).flatMap(orgs -> {
            List<Migrated> results = new ArrayList<>();
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (String slug : orgs.stream().map(o -> o.slug).toList()) {
                chain = chain.flatMap(i -> migrate(slug)
                        .onFailure().recoverWithItem(e -> {
                            LOG.warnf("Moving %s to native membership failed: %s", slug, e.getMessage());
                            return Migrated.failed(slug, e);
                        })
                        .invoke(results::add)
                        .replaceWithVoid());
            }
            return chain.map(i -> {
                if (results.stream().allMatch(r -> r.error() == null)) {
                    done.set(true);
                }
                return List.copyOf(results);
            });
        });
    }

    private Uni<Migrated> migrate(String slug) {
        if (alreadyNative) {
            return markNative(slug, new Migrated(slug, 0, 0, 0, null));
        }
        return Panache.withSession(() -> withoutChildGroups(slug)).flatMap(org -> {
            Uni<Migrated> imported = org.alfrescoGroupId == null
                    ? Uni.createFrom().item(new Migrated(slug, 0, 0, 0, null))
                    : bridge.importMembers(slug, ACTOR)
                            .map(r -> new Migrated(slug, r.added(), r.suspended(), 0, null));
            return imported
                    .flatMap(result -> bindDefaults(slug).map(bound -> new Migrated(slug, result.added(),
                            result.suspended(), bound, null)))
                    .flatMap(result -> markNative(slug, result));
        });
    }

    /** The organization; fails when a sub-account has its own Alfresco group, which the import does not read. */
    private static Uni<Organization> withoutChildGroups(String slug) {
        return Organization.findBySlug(slug).flatMap(org -> Organization.findByParent(org.id).map(children -> {
            if (children.stream().anyMatch(c -> c.alfrescoGroupId != null)) {
                throw new IllegalStateException("A sub-account has its own Alfresco group; only the top-level group"
                        + " is imported, so move its members by hand first");
            }
            return org;
        }));
    }

    /**
     * Binds each module's legacy-default role to active members who hold no role of that module, directly or through
     * a team. Returns how many bindings it made.
     */
    private Uni<Integer> bindDefaults(String slug) {
        Map<String, RoleDef> defaults = registry.legacyDefaults();
        if (defaults.isEmpty()) {
            return Uni.createFrom().item(0);
        }
        return Panache.withTransaction(() -> AlfrescoBridge.lock(slug)
                .flatMap(locked -> Organization.findBySlug(slug))
                .flatMap(org -> IamMembership.findByOrganization(org.id).flatMap(rows -> IamRoleBinding
                        .findByOrganization(org.id).flatMap(this::modulesHeld)
                        .map(held -> missingDefaults(org.id, rows, held, defaults))
                        .flatMap(NativeMembershipMigration::persistAll))));
    }

    /** A binding of each default role for every active member who holds no role of its module. */
    private static List<IamRoleBinding> missingDefaults(Long organizationId, List<IamMembership> rows,
            Map<UUID, Set<String>> held, Map<String, RoleDef> defaults) {
        List<IamRoleBinding> added = new ArrayList<>();
        for (IamMembership m : rows.stream().filter(r -> "ACTIVE".equals(r.status)).toList()) {
            Set<String> modules = held.getOrDefault(m.userId, Set.of());
            defaults.forEach((module, role) -> {
                if (!modules.contains(module)) {
                    added.add(IamRoleBinding.of(organizationId, IamRoleBinding.USER, m.userId.toString(), role.key(),
                            ACTOR));
                }
            });
        }
        return added;
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private static Uni<Integer> persistAll(List<IamRoleBinding> bindings) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (IamRoleBinding b : bindings) {
            chain = chain.flatMap(i -> b.persist().replaceWithVoid());
        }
        return chain.replaceWith(bindings.size());
    }

    /** The modules each user holds a role of, through their own bindings or their teams'. */
    private Uni<Map<UUID, Set<String>>> modulesHeld(List<IamRoleBinding> bindings) {
        Map<UUID, Set<String>> held = new HashMap<>();
        Map<UUID, Set<String>> byTeam = new HashMap<>();
        for (IamRoleBinding b : bindings) {
            String module = registry.role(b.roleKey).map(RoleDef::module).orElse(null);
            if (module == null) {
                continue;
            }
            if (IamRoleBinding.USER.equals(b.principalKind)) {
                held.computeIfAbsent(UUID.fromString(b.principalId), k -> new HashSet<>()).add(module);
            } else if (IamRoleBinding.TEAM.equals(b.principalKind)) {
                byTeam.computeIfAbsent(UUID.fromString(b.principalId), k -> new HashSet<>()).add(module);
            }
        }
        if (byTeam.isEmpty()) {
            return Uni.createFrom().item(held);
        }
        return IamTeamMember.findByTeams(List.copyOf(byTeam.keySet())).map(members -> {
            members.forEach(m -> held.computeIfAbsent(m.id.userId, k -> new HashSet<>())
                    .addAll(byTeam.get(m.id.teamId)));
            return held;
        });
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private static Uni<Migrated> markNative(String slug, Migrated result) {
        return Panache.withTransaction(() -> Organization.findBySlug(slug).flatMap(org -> {
            org.membershipSource = "NATIVE";
            return org.<Organization>persist()
                    .flatMap(saved -> IamAuditEvent.of(org.id, ACTOR, "membership.native", org.slug,
                            Map.of("added", result.added(), "suspended", result.suspended(),
                                    "defaultsBound", result.defaultsBound())).persist())
                    .invoke(ignored -> LOG.infof("%s now uses native membership: %d added, %d suspended, %d default"
                            + " roles bound", slug, result.added(), result.suspended(), result.defaultsBound()))
                    .replaceWith(result);
        }));
    }
}
