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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Copies an organization's Alfresco group into memberships, and keeps the group in step afterwards.
 *
 * <ul>
 *   <li>{@link #importMembers}: every member of the org's Alfresco group becomes a membership. Site and group
 *       managers are Admin, or Owner when the organization has no owner; everyone else is Member. Existing
 *       memberships keep their role. Memberships recorded from Alfresco for people no longer in the group are
 *       suspended. {@link NativeMembershipMigration} runs it once per organization.</li>
 *   <li>Projection, when {@value #PROJECTION_PROPERTY} is true: adding or removing a member of a native
 *       organization with an Alfresco group writes an outbox row in the same transaction; {@link #sendPending}
 *       applies it to Alfresco and retries failures, so BPM pooled tasks and document permissions follow.</li>
 * </ul>
 */
@ApplicationScoped
public class AlfrescoBridge {

    public static final String PROJECTION_PROPERTY = "miot.iam.alfresco-projection.enabled";
    private static final Set<String> MANAGER_ROLES = Set.of("SITE_MANAGER", "GROUP_ADMIN");
    private static final String ALFRESCO = "ALFRESCO";
    static final int MAX_ATTEMPTS = 10;
    private static final Logger LOG = Logger.getLogger(AlfrescoBridge.class);

    public record ImportResult(String organization, String groupId, int seen, int added, int alreadyMembers,
            int suspended) {
    }

    private final boolean projection;
    private final AccessEvaluator evaluator;
    private final IAlfrescoDirectoryClient directory;
    private final IAlfrescoMembershipClient membership;
    private final IAlfrescoGroupAdminClient groups;
    private final ProjectionQueue queue;

    @Inject
    public AlfrescoBridge(@ConfigProperty(name = PROJECTION_PROPERTY, defaultValue = "false") boolean projection,
            AccessEvaluator evaluator, IAlfrescoDirectoryClient directory, IAlfrescoMembershipClient membership,
            IAlfrescoGroupAdminClient groups, ProjectionQueue queue) {
        this.projection = projection;
        this.evaluator = evaluator;
        this.directory = directory;
        this.membership = membership;
        this.groups = groups;
        this.queue = queue;
    }

    // --- import ---

    /**
     * Copies the Alfresco group of {@code slug}'s top-level organization into memberships, under a lock per
     * organization so concurrent runs wait for each other.
     */
    public Uni<ImportResult> importMembers(String slug, String actor) {
        return Panache.withTransaction(() -> lock(slug)
                .flatMap(locked -> Organization.findBySlug(slug))
                .flatMap(found -> {
                    if (found == null) {
                        throw new NoSuchElementException("Organization not found: " + slug);
                    }
                    return evaluator.root(found);
                })
                .flatMap(org -> importInto(org, actor)));
    }

    private Uni<ImportResult> importInto(Organization org, String actor) {
        if (org.alfrescoGroupId == null) {
            throw new IllegalStateException("The organization has no Alfresco group");
        }
        return directory.listAllGroupMembers(org.alfrescoGroupId)
                .flatMap(people -> IamMembership.findByRole(org.id, BaseRole.OWNER.name())
                        .flatMap(owners -> addAll(org, people, owners.isEmpty(), actor)))
                .flatMap(result -> IamAuditEvent.of(org.id, actor, "alfresco.imported", org.alfrescoGroupId,
                        Map.of("seen", result.seen(), "added", result.added(), "suspended", result.suspended()))
                        .persist().replaceWith(result));
    }

    /** Holds a transaction-scoped lock for this organization's import until the transaction ends. */
    static Uni<Void> lock(String slug) {
        return Panache.getSession()
                .flatMap(session -> session.createNativeQuery("select pg_advisory_xact_lock(hashtext(?1))")
                        .setParameter(1, "iam-alfresco-import:" + slug)
                        .executeUpdate())
                .replaceWithVoid();
    }

    private Uni<ImportResult> addAll(Organization org, List<AlfrescoPerson> people, boolean noOwner, String actor) {
        int[] added = {0};
        int[] existing = {0};
        Set<String> inGroup = new HashSet<>();
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (AlfrescoPerson person : people) {
            String email = emailOf(person);
            if (email != null) {
                inGroup.add(email);
                chain = chain.flatMap(i -> importOne(org, person, email, noOwner, actor)
                        .invoke(isNew -> (Boolean.TRUE.equals(isNew) ? added : existing)[0]++)
                        .replaceWithVoid());
            }
        }
        return chain.flatMap(i -> suspendLeavers(org.id, inGroup))
                .map(suspended -> new ImportResult(org.slug, org.alfrescoGroupId, people.size(), added[0],
                        existing[0], suspended));
    }

    /**
     * Suspends the active memberships recorded from Alfresco for people who are no longer in the group: Alfresco
     * decided their access before, so the row alone must not let them back in.
     */
    private static Uni<Integer> suspendLeavers(Long organizationId, Set<String> inGroup) {
        return IamMembership.findByOrganization(organizationId).flatMap(rows -> {
            List<IamMembership> fromAlfresco = rows.stream()
                    .filter(m -> "ACTIVE".equals(m.status) && ALFRESCO.equals(m.source))
                    .toList();
            return IamUser.findByIds(fromAlfresco.stream().map(m -> m.userId).toList()).flatMap(users -> {
                Set<UUID> gone = new HashSet<>();
                users.stream().filter(u -> !inGroup.contains(IamUser.normalize(u.email))).forEach(u -> gone.add(u.id));
                Uni<Void> chain = Uni.createFrom().voidItem();
                for (IamMembership m : fromAlfresco) {
                    if (gone.contains(m.userId)) {
                        m.status = "SUSPENDED";
                        chain = chain.flatMap(i -> m.persist().replaceWithVoid());
                    }
                }
                return chain.replaceWith(gone.size());
            });
        });
    }

    /** The person's email, from the email field or the user id; null when neither is an email. */
    private static String emailOf(AlfrescoPerson person) {
        String email = IamUser.normalize(person.email() != null && !person.email().isBlank()
                ? person.email() : person.id());
        return email != null && email.contains("@") ? email : null;
    }

    /** Adds the person as a member unless they already are; true when added. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<Boolean> importOne(Organization org, AlfrescoPerson person, String email, boolean noOwner,
            String actor) {
        return membership.getRole(email, org.alfrescoGroupId)
                .flatMap(role -> IamUser.findOrCreate(email)
                        .flatMap(user -> named(user, person))
                        .flatMap(user -> IamMembership.findOne(org.id, user.id).flatMap(m -> m != null
                                ? Uni.createFrom().item(false)
                                : IamMembership.of(org.id, user.id, baseRoleOf(role, noOwner).name(),
                                        ALFRESCO, actor).persist().replaceWith(true))));
    }

    /**
     * Site and group managers are Admin, or Owner while the organization has none, as Alfresco made them; everyone
     * else is Member.
     */
    static BaseRole baseRoleOf(String alfrescoRole, boolean noOwner) {
        if (alfrescoRole == null || !MANAGER_ROLES.contains(alfrescoRole)) {
            return BaseRole.MEMBER;
        }
        return noOwner ? BaseRole.OWNER : BaseRole.ADMIN;
    }

    private static Uni<IamUser> named(IamUser user, AlfrescoPerson person) {
        if (person.displayName() != null && user.name == null) {
            user.name = person.displayName();
        }
        return user.persist();
    }

    // --- projection ---

    /** Queues adding {@code email} to the org's Alfresco group, when projection applies. Needs an open session. */
    public Uni<Void> memberAdded(Long organizationId, String email) {
        return queue.memberChanged(organizationId, email, true);
    }

    /** Queues removing {@code email} from the org's Alfresco group, when projection applies. */
    public Uni<Void> memberRemoved(Long organizationId, String email) {
        return queue.memberChanged(organizationId, email, false);
    }

    /**
     * The group a member is added to. A site's own group ({@code GROUP_site_<id>}) only holds the site's role groups,
     * so members go to its Consumer group, which gives read access to the site. Any other group is used as is.
     */
    static String memberGroupOf(String alfrescoGroupId) {
        if (alfrescoGroupId != null && alfrescoGroupId.startsWith("GROUP_site_")
                && !alfrescoGroupId.matches(".*_Site(Manager|Collaborator|Contributor|Consumer)$")) {
            return alfrescoGroupId + "_SiteConsumer";
        }
        return alfrescoGroupId;
    }

    /** Whether {@code groupId} holds the org's members, so its content follows membership, not a role. */
    static boolean isMemberGroup(Organization org, String groupId) {
        return org.alfrescoGroupId != null
                && (groupId.equals(org.alfrescoGroupId) || groupId.equals(memberGroupOf(org.alfrescoGroupId)));
    }

    /** Sends pending changes to Alfresco, oldest first; a failure is retried up to {@value #MAX_ATTEMPTS} times. */
    @Scheduled(every = "${miot.iam.alfresco-projection.every:30s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> sendPending() {
        if (!projection) {
            return Uni.createFrom().voidItem();
        }
        return Panache.withSession(() -> IamProjectionChange.findPending(50)).flatMap(changes -> {
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (IamProjectionChange change : changes) {
                chain = chain.flatMap(i -> send(change));
            }
            return chain;
        });
    }

    /** Calls Alfresco with no transaction open, then records the outcome in a short one. */
    private Uni<Void> send(IamProjectionChange change) {
        return Uni.createFrom().deferred(() -> IamProjectionChange.MEMBER_ADDED.equals(change.kind)
                        ? groups.addGroupMember(change.groupId, change.subject)
                        : groups.removeGroupMember(change.groupId, change.subject))
                .<String>map(ok -> null)
                .onFailure().recoverWithItem(e -> truncate(e.getMessage()))
                .flatMap(error -> Panache.withTransaction(() -> recordOutcome(change.id, error)));
    }

    @SuppressWarnings({"java:S1612", "java:S3252"}) // Reactive Panache: persist overloads; finders per entity.
    private static Uni<Void> recordOutcome(Long id, String error) {
        return IamProjectionChange.<IamProjectionChange>findById(id).flatMap(row -> {
            if (row == null) {
                return Uni.createFrom().voidItem();
            }
            if (error == null) {
                row.status = IamProjectionChange.SYNCED;
                row.lastError = null;
            } else {
                row.attempts++;
                row.lastError = error;
                if (row.attempts >= MAX_ATTEMPTS) {
                    row.status = IamProjectionChange.FAILED;
                    LOG.warnf("Alfresco projection %d gave up after %d attempts: %s", row.id, row.attempts, error);
                }
            }
            row.updatedAt = Instant.now();
            return row.<IamProjectionChange>persist().replaceWithVoid();
        });
    }

    private static String truncate(String message) {
        if (message == null) {
            return "unknown error";
        }
        return message.length() > 1000 ? message.substring(0, 1000) : message;
    }
}
