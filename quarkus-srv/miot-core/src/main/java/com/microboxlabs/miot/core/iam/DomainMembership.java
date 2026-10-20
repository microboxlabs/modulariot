package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.iam.model.IamMemberDomain;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * People whose email is in one of a top-level organization's domains become Members when they first sign in. They get
 * no module roles; those come from the Team page or the token. Removing such a member suspends the membership, so they
 * do not join again.
 */
@ApplicationScoped
public class DomainMembership {

    public static final String SOURCE = "DOMAIN";
    public static final String VERIFIED_PROPERTY = "miot.iam.member-domains.require-verified-email";
    private static final String ACTOR = "domain";

    public record DomainView(String domain) {
    }

    private final boolean requireVerified;
    private final ProjectionQueue projection;

    @Inject
    public DomainMembership(@ConfigProperty(name = VERIFIED_PROPERTY, defaultValue = "true") boolean requireVerified,
            ProjectionQueue projection) {
        this.requireVerified = requireVerified;
        this.projection = projection;
    }

    /** The lower-case domain of an email; null when it has none. */
    static String domainOf(String email) {
        if (email == null) {
            return null;
        }
        int at = email.lastIndexOf('@');
        return at < 0 || at == email.length() - 1 ? null : email.substring(at + 1).trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Makes {@code email} a Member of {@code root} when its domain belongs to the org, the email is verified, and the
     * person has no membership, active or suspended. True when it did. Needs an open transaction.
     */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<Boolean> join(Organization root, String email, boolean emailVerified) {
        String domain = domainOf(email);
        if (domain == null || (requireVerified && !emailVerified)) {
            return Uni.createFrom().item(false);
        }
        return IamMemberDomain.findByDomain(domain).flatMap(found -> {
            if (found == null || !found.organizationId.equals(root.id)) {
                return Uni.createFrom().item(false);
            }
            return IamUser.findOrCreate(email).flatMap(user -> {
                if (!"ACTIVE".equals(user.status)) {
                    return Uni.createFrom().item(false);
                }
                return IamMembership.findOne(root.id, user.id).flatMap(existing -> existing != null
                        ? Uni.createFrom().item(false)
                        : IamMembership.of(root.id, user.id, BaseRole.MEMBER.name(), SOURCE, ACTOR).persist()
                                .flatMap(created -> projection.memberChanged(root.id, user.email, true))
                                .flatMap(queued -> IamAuditEvent.of(root.id, ACTOR, "member.joined", user.email,
                                        Map.of("emailDomain", domain)).persist())
                                .replaceWith(true));
            });
        });
    }

    // --- the domains, for platform owners ---

    public Uni<List<DomainView>> list(String slug) {
        return Panache.withSession(() -> root(slug).flatMap(org -> IamMemberDomain.findByOrganization(org.id))
                .map(rows -> rows.stream().map(r -> new DomainView(r.domain)).toList()));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<DomainView> put(String slug, String domain, String actor) {
        String d = domain == null ? "" : domain.trim().toLowerCase(Locale.ROOT);
        if (!isDomain(d)) {
            throw new IllegalArgumentException("Not a domain: " + domain);
        }
        return Panache.withTransaction(() -> root(slug).flatMap(org -> IamMemberDomain.findByDomain(d)
                .flatMap(found -> {
                    if (found != null && !found.organizationId.equals(org.id)) {
                        throw new IllegalStateException("The domain belongs to another organization: " + d);
                    }
                    if (found != null) {
                        return Uni.createFrom().item(new DomainView(d));
                    }
                    return IamMemberDomain.of(org.id, d, actor).persist()
                            .flatMap(saved -> IamAuditEvent.of(org.id, actor, "member-domain.added", d, Map.of())
                                    .persist())
                            .replaceWith(new DomainView(d));
                })));
    }

    public Uni<Void> delete(String slug, String domain, String actor) {
        String d = domain == null ? "" : domain.trim().toLowerCase(Locale.ROOT);
        return Panache.withTransaction(() -> root(slug).flatMap(org -> IamMemberDomain.findByDomain(d)
                .flatMap(found -> {
                    if (found == null || !found.organizationId.equals(org.id)) {
                        throw new NoSuchElementException("No such domain: " + d);
                    }
                    return found.delete()
                            .flatMap(i -> IamAuditEvent.of(org.id, actor, "member-domain.removed", d, Map.of())
                                    .persist())
                            .replaceWithVoid();
                })));
    }

    /** A host name of at least two labels: each 1 to 63 letters, digits or inner hyphens; 253 characters at most. */
    static boolean isDomain(String d) {
        String[] labels = d.split("\\.", -1);
        if (d.length() > 253 || labels.length < 2) {
            return false;
        }
        for (String label : labels) {
            if (!isLabel(label)) {
                return false;
            }
        }
        return true;
    }

    private static boolean isLabel(String label) {
        if (label.isEmpty() || label.length() > 63 || label.startsWith("-") || label.endsWith("-")) {
            return false;
        }
        return label.chars().allMatch(c -> (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-');
    }

    @SuppressWarnings("java:S3252") // Reactive Panache generates findById per entity.
    private static Uni<Organization> root(String slug) {
        return Organization.findBySlug(slug).flatMap(found -> {
            if (found == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            if (found.parent != null) {
                return Organization.<Organization>findById(found.parent.id);
            }
            return Uni.createFrom().item(found);
        });
    }
}
