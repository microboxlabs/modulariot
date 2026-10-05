package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.alfresco.IAlfrescoGroupAdminClient;
import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamProjectionChange;
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
import java.util.NoSuchElementException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Moves an organization from Alfresco membership to native membership without losing anyone, and keeps its Alfresco
 * group in step afterwards.
 *
 * <ul>
 *   <li>{@link #importMembers}: every member of the org's Alfresco group becomes a membership (site and group
 *       managers as Admin, everyone else as Member). Existing memberships keep their role.</li>
 *   <li>Projection, when {@value #PROJECTION_PROPERTY} is true: adding or removing a member of a native
 *       organization with an Alfresco group writes an outbox row in the same transaction; {@link #sendPending}
 *       applies it to Alfresco and retries failures, so BPM pooled tasks and document permissions follow.</li>
 * </ul>
 */
@ApplicationScoped
public class AlfrescoBridge {

    public static final String PROJECTION_PROPERTY = "miot.iam.alfresco-projection.enabled";
    static final int MAX_ATTEMPTS = 10;
    static final int PAGE = 100;
    private static final Logger LOG = Logger.getLogger(AlfrescoBridge.class);

    public record ImportResult(String organization, String groupId, int seen, int added, int alreadyMembers) {
    }

    private final boolean projection;
    private final AccessEvaluator evaluator;
    private final IAlfrescoDirectoryClient directory;
    private final IAlfrescoMembershipClient membership;
    private final IAlfrescoGroupAdminClient groups;

    @Inject
    public AlfrescoBridge(@ConfigProperty(name = PROJECTION_PROPERTY, defaultValue = "false") boolean projection,
            AccessEvaluator evaluator, IAlfrescoDirectoryClient directory, IAlfrescoMembershipClient membership,
            IAlfrescoGroupAdminClient groups) {
        this.projection = projection;
        this.evaluator = evaluator;
        this.directory = directory;
        this.membership = membership;
        this.groups = groups;
    }

    // --- import ---

    /** Copies the org's Alfresco group into memberships. Run it before switching the org to NATIVE. */
    public Uni<ImportResult> importMembers(String slug, String actor) {
        return Panache.withTransaction(() -> Organization.findBySlug(slug).flatMap(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            if (org.parent != null) {
                throw new IllegalArgumentException("Import the top-level organization; sub-accounts share it");
            }
            if (org.alfrescoGroupId == null) {
                throw new IllegalStateException("The organization has no Alfresco group");
            }
            return people(org.alfrescoGroupId, 0, new ArrayList<>())
                    .flatMap(people -> addAll(org, people, actor))
                    .flatMap(result -> IamAuditEvent.of(org.id, actor, "alfresco.imported", org.alfrescoGroupId,
                            Map.of("seen", result.seen(), "added", result.added())).persist().replaceWith(result));
        }));
    }

    private Uni<List<AlfrescoPerson>> people(String groupId, int skip, List<AlfrescoPerson> acc) {
        return directory.listGroupMembers(groupId, PAGE, skip).flatMap(page -> {
            acc.addAll(page);
            return page.size() < PAGE ? Uni.createFrom().item(acc) : people(groupId, skip + PAGE, acc);
        });
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<ImportResult> addAll(Organization org, List<AlfrescoPerson> people, String actor) {
        int[] added = {0};
        int[] existing = {0};
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (AlfrescoPerson person : people) {
            String email = IamUser.normalize(person.email() != null && !person.email().isBlank()
                    ? person.email() : person.id());
            if (email == null || !email.contains("@")) {
                continue;
            }
            chain = chain.flatMap(i -> membership.getRole(email, org.alfrescoGroupId)
                    .flatMap(role -> IamUser.findOrCreate(email).flatMap(user -> {
                        if (person.displayName() != null && user.name == null) {
                            user.name = person.displayName();
                        }
                        return user.<IamUser>persist();
                    }).flatMap(user -> IamMembership.findOne(org.id, user.id).flatMap(m -> {
                        if (m != null) {
                            existing[0]++;
                            return Uni.createFrom().voidItem();
                        }
                        added[0]++;
                        BaseRole base = role != null && AccessEvaluator.BOOTSTRAP_MANAGER_ROLES.contains(role)
                                ? BaseRole.ADMIN : BaseRole.MEMBER;
                        return IamMembership.of(org.id, user.id, base.name(), "ALFRESCO", actor).persist()
                                .replaceWithVoid();
                    }))));
        }
        return chain.map(i -> new ImportResult(org.slug, org.alfrescoGroupId, people.size(), added[0],
                existing[0]));
    }

    // --- projection ---

    /** Queues adding {@code email} to the org's Alfresco group, when projection applies. Needs an open session. */
    public Uni<Void> memberAdded(Long organizationId, String email) {
        return queue(organizationId, IamProjectionChange.MEMBER_ADDED, email);
    }

    /** Queues removing {@code email} from the org's Alfresco group, when projection applies. */
    public Uni<Void> memberRemoved(Long organizationId, String email) {
        return queue(organizationId, IamProjectionChange.MEMBER_REMOVED, email);
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<Void> queue(Long organizationId, String kind, String email) {
        if (!projection || email == null) {
            return Uni.createFrom().voidItem();
        }
        return Organization.<Organization>findById(organizationId).flatMap(org -> {
            if (org == null || org.alfrescoGroupId == null || !evaluator.isNative(org)) {
                return Uni.createFrom().voidItem();
            }
            return IamProjectionChange.of(org.id, kind, org.alfrescoGroupId, IamUser.normalize(email)).persist()
                    .replaceWithVoid();
        });
    }

    /** Sends pending changes to Alfresco, oldest first; a failure is retried up to {@value #MAX_ATTEMPTS} times. */
    @Scheduled(every = "${miot.iam.alfresco-projection.every:30s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> sendPending() {
        if (!projection) {
            return Uni.createFrom().voidItem();
        }
        return Panache.withTransaction(() -> IamProjectionChange.pending(50).flatMap(changes -> {
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (IamProjectionChange change : changes) {
                chain = chain.flatMap(i -> send(change));
            }
            return chain;
        }));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<Void> send(IamProjectionChange change) {
        Uni<Void> call = IamProjectionChange.MEMBER_ADDED.equals(change.kind)
                ? groups.addGroupMember(change.groupId, change.subject)
                : groups.removeGroupMember(change.groupId, change.subject);
        return call.map(ok -> {
            change.status = IamProjectionChange.SYNCED;
            change.lastError = null;
            return change;
        }).onFailure().recoverWithItem(e -> {
            change.attempts++;
            change.lastError = truncate(e.getMessage());
            if (change.attempts >= MAX_ATTEMPTS) {
                change.status = IamProjectionChange.FAILED;
                LOG.warnf("Alfresco projection %d gave up after %d attempts: %s", change.id, change.attempts,
                        change.lastError);
            }
            return change;
        }).flatMap(updated -> {
            updated.updatedAt = Instant.now();
            return updated.persist().replaceWithVoid();
        });
    }

    private static String truncate(String message) {
        if (message == null) {
            return "unknown error";
        }
        return message.length() > 1000 ? message.substring(0, 1000) : message;
    }
}
