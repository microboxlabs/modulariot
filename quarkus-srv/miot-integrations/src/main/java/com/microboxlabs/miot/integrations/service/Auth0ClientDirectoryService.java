package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.client.Auth0ApplicationsClient;
import com.microboxlabs.miot.integrations.dto.Auth0ApplicationRow;
import com.microboxlabs.miot.integrations.dto.Auth0ClientSummary;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

/**
 * The set of Auth0 M2M clients an organization may configure a credential
 * against, assembled from two sources of very different standing.
 *
 * <p><b>The organization tree is the authority.</b> An {@code Organization}
 * carries the Auth0 client id that scopes all of its data queries
 * ({@code tenant_client_id}, which equals {@code Tenant.code}), and the tree is
 * at most two levels deep. So "which clients may this org use?" is answered by
 * the org record plus its children — no Auth0 call, no privileged credential,
 * and no way to name a client belonging to somebody else's subtree. Entitlement
 * is computed here rather than upstream because this is where the hierarchy
 * lives; the applications service has no organization model at all.
 *
 * <p><b>The directory is advisory.</b> When configured, the applications
 * service contributes clients that no organization is bound to yet — a newly
 * created one, or a client that exists for a purpose other than scoping a
 * tenant. Those are additive suggestions, so a directory row never overwrites
 * an organization row and the whole source is optional: if it is unconfigured,
 * slow or broken, the caller still gets the authoritative half rather than an
 * error. A credential picker that fails closed just blocks the operator.
 */
@ApplicationScoped
public class Auth0ClientDirectoryService {

    private static final Logger LOG = Logger.getLogger(Auth0ClientDirectoryService.class);

    /** Ceiling on what any caller can ask to render. */
    public static final int MAX_LIMIT = 100;

    private final Auth0ApplicationsClient applicationsClient;
    private final boolean directoryEnabled;

    @Inject
    public Auth0ClientDirectoryService(
            @RestClient Auth0ApplicationsClient applicationsClient,
            @ConfigProperty(name = "miot.integrations.auth0-directory.enabled", defaultValue = "false")
            boolean directoryEnabled) {
        this.applicationsClient = applicationsClient;
        this.directoryEnabled = directoryEnabled;
    }

    /** Whether the optional applications service is wired up in this deployment. */
    public boolean isDirectoryEnabled() {
        return directoryEnabled;
    }

    /**
     * Lists the clients {@code orgSlug} may select.
     *
     * @param orgSlug the organization whose entitlement scopes the result
     * @param query   case-insensitive filter over name and client id; blank for all
     * @param limit   caller's page size, clamped to {@link #MAX_LIMIT}
     */
    public Uni<List<Auth0ClientSummary>> list(String orgSlug, String query, int limit) {
        int capped = Math.min(Math.max(limit, 1), MAX_LIMIT);
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);

        return organizationClients(orgSlug)
                .flatMap(owned -> directoryClients(needle, capped)
                        .map(discovered -> merge(owned, discovered)))
                .map(all -> filterAndCap(all, needle, capped));
    }

    /**
     * The org's own client plus its active children's.
     *
     * <p>Opens its own session. The caller reaches this after
     * {@code OrganizationRoleService.requireOwner}, which wraps its work in its
     * own {@code Panache.withSession} — that session is closed by the time this
     * runs, so without one here the query fails with "No current Mutiny.Session
     * found". Scoping it to just these two queries, rather than annotating
     * {@link #list} with {@code @WithSession}, also means no database session is
     * held open across the directory's blocking HTTP call.
     *
     * <p>The queries run one after another rather than in parallel: they are
     * Panache reactive calls sharing a session, and racing them is what produces
     * the intermittent session failures seen elsewhere in this codebase.
     */
    private Uni<List<Auth0ClientSummary>> organizationClients(String orgSlug) {
        return Panache.withSession(() -> Organization.findBySlug(orgSlug)
                .flatMap(org -> {
                    if (org == null) {
                        return Uni.createFrom().item(List.<Auth0ClientSummary>of());
                    }
                    return Organization.findByParent(org.id)
                            .map(children -> {
                                List<Auth0ClientSummary> out = new ArrayList<>();
                                addOrganization(out, org, null);
                                for (Organization child : children) {
                                    addOrganization(out, child, org);
                                }
                                return out;
                            });
                }));
    }

    /**
     * Appends an org's client, skipping any org with no client id — a row the
     * operator could select but not authenticate as is worse than an absent one.
     */
    static void addOrganization(
            List<Auth0ClientSummary> out, Organization org, Organization parent) {
        if (org.tenantClientId == null || org.tenantClientId.isBlank()) {
            return;
        }
        String label = org.displayName != null && !org.displayName.isBlank()
                ? org.displayName
                : org.name;
        String description = parent == null
                ? org.slug
                : org.slug + " · " + parent.slug;
        out.add(new Auth0ClientSummary(
                org.tenantClientId.trim(),
                label,
                description,
                org.active,
                Auth0ClientSummary.Source.ORGANIZATION));
    }

    /**
     * The optional half. Runs on the worker pool because the REST client is
     * blocking, and swallows every failure into an empty list: the directory
     * only ever adds suggestions, so its absence must not turn a working picker
     * into an error.
     */
    private Uni<List<Auth0ClientSummary>> directoryClients(String needle, int limit) {
        if (!directoryEnabled) {
            return Uni.createFrom().item(List.of());
        }
        return Uni.createFrom().item(() -> fetchDirectory(needle, limit))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .onFailure().recoverWithItem(failure -> {
                    LOG.warnf(failure, "Auth0 applications directory unavailable; "
                            + "returning organization-derived clients only");
                    return List.of();
                });
    }

    private List<Auth0ClientSummary> fetchDirectory(String needle, int limit) {
        List<Auth0ApplicationRow> rows =
                applicationsClient.list(needle.isEmpty() ? null : needle, limit);
        if (rows == null) {
            return List.of();
        }
        List<Auth0ClientSummary> out = new ArrayList<>(rows.size());
        for (Auth0ApplicationRow row : rows) {
            String clientId = row.resolveClientId();
            if (clientId == null) {
                continue;
            }
            String label = row.name != null && !row.name.isBlank() ? row.name.trim() : clientId;
            out.add(new Auth0ClientSummary(
                    clientId,
                    label,
                    row.description,
                    row.active == null || row.active,
                    Auth0ClientSummary.Source.DIRECTORY));
        }
        return out;
    }

    /**
     * Organization rows win on client-id collision — the org record is what
     * grants the entitlement, and its label is the one the operator recognizes.
     * Insertion order is preserved so the org's own client stays first.
     */
    static List<Auth0ClientSummary> merge(
            List<Auth0ClientSummary> owned, List<Auth0ClientSummary> discovered) {
        Map<String, Auth0ClientSummary> byId = new LinkedHashMap<>();
        for (Auth0ClientSummary summary : owned) {
            byId.put(summary.clientId(), summary);
        }
        for (Auth0ClientSummary summary : discovered) {
            byId.putIfAbsent(summary.clientId(), summary);
        }
        return new ArrayList<>(byId.values());
    }

    /**
     * Normalizes the search term itself rather than trusting the caller to have
     * done it. {@link #list} happens to pass one already lowercased, and a
     * helper that only works for callers who know that is a trap for the next
     * one — it would silently return no matches instead of failing.
     */
    static List<Auth0ClientSummary> filterAndCap(
            List<Auth0ClientSummary> all, String needle, int limit) {
        String normalized = needle == null ? "" : needle.trim().toLowerCase(Locale.ROOT);
        List<Auth0ClientSummary> out = new ArrayList<>();
        for (Auth0ClientSummary summary : all) {
            if (out.size() == limit) {
                break;
            }
            if (matches(summary, normalized)) {
                out.add(summary);
            }
        }
        return out;
    }

    /** @param needle must already be lowercased — see {@link #filterAndCap}. */
    private static boolean matches(Auth0ClientSummary summary, String needle) {
        if (needle.isEmpty()) {
            return true;
        }
        return summary.name().toLowerCase(Locale.ROOT).contains(needle)
                || summary.clientId().toLowerCase(Locale.ROOT).contains(needle);
    }
}
