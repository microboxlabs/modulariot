package com.microboxlabs.miot.core.alfresco;

import com.microboxlabs.miot.core.alfresco.client.AlfrescoClientException;
import com.microboxlabs.miot.core.alfresco.client.AlfrescoCoreApi;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoGroupMemberEntry;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoPersonEntry;
import io.quarkus.arc.lookup.LookupUnlessProperty;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

/**
 * Real implementation of {@link IAlfrescoDirectoryClient} backed by
 * {@link AlfrescoCoreApi}. Active whenever {@code miot.alfresco.auth}
 * is set to anything other than {@code stub}; in {@code stub} mode the
 * {@link StubAlfrescoDirectoryClient} {@code @DefaultBean} wins.
 *
 * <p>{@code listGroupMembers} filters to {@code PERSON} entries
 * (subgroups are ignored) and then hydrates each member by calling
 * {@code GET /people/{id}}. Alfresco's group-members endpoint returns
 * only id + displayName; the admin UI needs email + firstName/lastName.
 * The hydration is fanned out with {@code Uni.combine()} — safe here
 * because these are HTTP calls with no Hibernate session.
 */
@ApplicationScoped
@LookupUnlessProperty(name = "miot.alfresco.auth", stringValue = "stub", lookupIfMissing = false)
public class RealAlfrescoDirectoryClient implements IAlfrescoDirectoryClient {

    private static final Logger LOG = Logger.getLogger(RealAlfrescoDirectoryClient.class);

    private final AlfrescoCoreApi coreApi;

    public RealAlfrescoDirectoryClient(@RestClient AlfrescoCoreApi coreApi) {
        this.coreApi = coreApi;
    }

    @Override
    public Uni<List<AlfrescoPerson>> listGroupMembers(String groupId, int maxItems, int skipCount) {
        return coreApi.listGroupMembers(groupId, maxItems, skipCount)
                .onFailure(AlfrescoClientException.class).recoverWithItem(ex -> {
                    if (ex.isNotFound()) {
                        LOG.debugf("Group %s not found in Alfresco", groupId);
                        return null;
                    }
                    throw ex;
                })
                .flatMap(response -> {
                    if (response == null) {
                        return Uni.createFrom().item(List.<AlfrescoPerson>of());
                    }
                    List<AlfrescoGroupMemberEntry> personEntries = response.unwrap().stream()
                            .filter(m -> "PERSON".equalsIgnoreCase(m.memberType()))
                            .toList();
                    if (personEntries.isEmpty()) {
                        return Uni.createFrom().item(List.of());
                    }
                    return hydrateMembers(personEntries);
                });
    }

    private Uni<List<AlfrescoPerson>> hydrateMembers(List<AlfrescoGroupMemberEntry> members) {
        // Parallel fan-out is safe: no shared Hibernate session on these HTTP calls.
        List<Uni<AlfrescoPerson>> hydrations = members.stream()
                .map(member -> coreApi.getPerson(member.id())
                        .map(wrap -> toDomain(wrap.entry()))
                        .onFailure(AlfrescoClientException.class).recoverWithItem(e -> {
                            LOG.debugf("Failed to hydrate person %s: %s", member.id(), e.getMessage());
                            return new AlfrescoPerson(
                                    member.id(),
                                    member.id(),
                                    null,
                                    null,
                                    member.displayName());
                        }))
                .toList();
        return Uni.combine().all().unis(hydrations).with(list ->
                list.stream().map(o -> (AlfrescoPerson) o).toList());
    }

    @Override
    public Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems) {
        String term = query == null ? "" : query.trim();
        if (term.isEmpty()) {
            return Uni.createFrom().item(List.of());
        }
        return coreApi.searchPeople(term, maxItems)
                .map(response -> response.unwrap().stream()
                        .map(RealAlfrescoDirectoryClient::toDomain)
                        .toList());
    }

    private static AlfrescoPerson toDomain(AlfrescoPersonEntry entry) {
        if (entry == null) {
            return null;
        }
        String displayName = entry.displayName();
        if (displayName == null || displayName.isBlank()) {
            String first = entry.firstName() != null ? entry.firstName() : "";
            String last = entry.lastName() != null ? entry.lastName() : "";
            displayName = (first + " " + last).trim();
            if (displayName.isEmpty()) {
                displayName = entry.id();
            }
        }
        return new AlfrescoPerson(
                entry.id(),
                entry.email() != null ? entry.email() : entry.id(),
                entry.firstName(),
                entry.lastName(),
                displayName);
    }
}
