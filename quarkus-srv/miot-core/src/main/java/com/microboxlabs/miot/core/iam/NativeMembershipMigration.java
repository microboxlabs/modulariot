package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;

/**
 * Moves organizations whose members came from their Alfresco group onto memberships: imports the group (see
 * {@link AlfrescoBridge#importMembers}), then marks the organization NATIVE. Runs shortly after start and again
 * every 30 minutes; an organization whose import fails is tried again on the next run.
 */
@ApplicationScoped
public class NativeMembershipMigration {

    static final String ACTOR = "native-migration";
    private static final Logger LOG = Logger.getLogger(NativeMembershipMigration.class);

    /** One organization moved: how many people the import added. */
    public record Migrated(String organization, int added) {
    }

    private final AlfrescoBridge bridge;

    @Inject
    public NativeMembershipMigration(AlfrescoBridge bridge) {
        this.bridge = bridge;
    }

    @Scheduled(every = "${miot.iam.native-migration.every:30m}", delayed = "10s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> scheduled() {
        return migrateAll().replaceWithVoid();
    }

    /** Moves every organization still on Alfresco membership; the ones that failed are left for the next run. */
    public Uni<List<Migrated>> migrateAll() {
        return Panache.withSession(Organization::listAlfrescoMembership).flatMap(orgs -> {
            List<Migrated> done = new ArrayList<>();
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (String slug : orgs.stream().map(o -> o.slug).toList()) {
                chain = chain.flatMap(i -> migrate(slug)
                        .invoke(done::add)
                        .onFailure().invoke(e -> LOG.warnf("Moving %s to native membership failed: %s", slug,
                                e.getMessage()))
                        .onFailure().recoverWithNull()
                        .replaceWithVoid());
            }
            return chain.map(i -> List.copyOf(done));
        });
    }

    /** Imports the organization's Alfresco group, when it has one, and marks it NATIVE. */
    private Uni<Migrated> migrate(String slug) {
        return Panache.withSession(() -> Organization.findBySlug(slug)).flatMap(org -> {
            if (org.alfrescoGroupId == null) {
                return markNative(slug, 0);
            }
            return bridge.importMembers(slug, ACTOR).flatMap(result -> markNative(slug, result.added()));
        });
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private static Uni<Migrated> markNative(String slug, int added) {
        return Panache.withTransaction(() -> Organization.findBySlug(slug).flatMap(org -> {
            org.membershipSource = "NATIVE";
            return org.<Organization>persist()
                    .flatMap(saved -> IamAuditEvent.of(org.id, ACTOR, "membership.native", org.slug,
                            Map.of("added", added)).persist())
                    .invoke(ignored -> LOG.infof("%s now uses native membership; %d members added from Alfresco",
                            slug, added))
                    .replaceWith(new Migrated(slug, added));
        }));
    }
}
