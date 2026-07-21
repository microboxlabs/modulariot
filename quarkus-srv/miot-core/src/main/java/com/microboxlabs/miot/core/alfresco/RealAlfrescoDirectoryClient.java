package com.microboxlabs.miot.core.alfresco;

import com.microboxlabs.miot.core.alfresco.client.AlfrescoClientException;
import com.microboxlabs.miot.core.alfresco.client.AlfrescoCoreApi;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoGroupMemberEntry;
import com.microboxlabs.miot.core.alfresco.model.AlfrescoPersonEntry;
import io.quarkus.arc.lookup.LookupUnlessProperty;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

/**
 * Real implementation of {@link IAlfrescoDirectoryClient} backed by
 * {@link AlfrescoCoreApi}. Active whenever {@code miot.alfresco.auth}
 * is set to anything other than {@code stub}; in {@code stub} mode the
 * {@link StubAlfrescoDirectoryClient} {@code @DefaultBean} wins.
 *
 * <p>{@code listGroupMembers} recursively expands nested groups before hydrating
 * each distinct person through {@code GET /people/{id}}. Alfresco site groups
 * contain role groups rather than people directly, so flattening is required to
 * expose a useful organization roster. Traversal and hydration are sequential to
 * avoid unbounded outbound bursts.
 */
@ApplicationScoped
@LookupUnlessProperty(name = "miot.alfresco.auth", stringValue = "stub", lookupIfMissing = false)
public class RealAlfrescoDirectoryClient implements IAlfrescoDirectoryClient {

    private static final Logger LOG = Logger.getLogger(RealAlfrescoDirectoryClient.class);
    private static final int MAX_PAGE_SIZE = 50;

    private final AlfrescoCoreApi coreApi;

    public RealAlfrescoDirectoryClient(@RestClient AlfrescoCoreApi coreApi) {
        this.coreApi = coreApi;
    }

    @Override
    public Uni<List<AlfrescoPerson>> listGroupMembers(String groupId, int maxItems, int skipCount) {
        int safeMaxItems = sanitizeMaxItems(maxItems);
        int safeSkipCount = sanitizeSkipCount(skipCount);
        if (safeMaxItems == 0) {
            return Uni.createFrom().item(List.of());
        }
        return collectGroupMembers(groupId, new HashSet<>(), new LinkedHashMap<>())
                .flatMap(this::hydrateMembers)
                .map(members -> page(members, safeMaxItems, safeSkipCount));
    }

    @Override
    public Uni<String> getSiteRole(String personId, String siteId) {
        return coreApi.getSiteMember(siteId, personId)
                .map(response -> response.entry() == null ? null : response.entry().role())
                .onFailure(AlfrescoClientException.class).recoverWithItem(ex -> {
                    if (ex.isNotFound()) {
                        return null;
                    }
                    throw ex;
                });
    }

    private Uni<Map<String, AlfrescoGroupMemberEntry>> collectGroupMembers(
            String groupId,
            Set<String> visitedGroups,
            Map<String, AlfrescoGroupMemberEntry> people) {
        if (!visitedGroups.add(groupId)) {
            return Uni.createFrom().item(people);
        }
        return collectGroupPage(groupId, 0, visitedGroups, people);
    }

    private Uni<Map<String, AlfrescoGroupMemberEntry>> collectGroupPage(
            String groupId,
            int skipCount,
            Set<String> visitedGroups,
            Map<String, AlfrescoGroupMemberEntry> people) {
        return coreApi.listGroupMembers(groupId, MAX_PAGE_SIZE, skipCount)
                .onFailure(AlfrescoClientException.class).recoverWithItem(ex -> {
                    if (ex.isNotFound()) {
                        LOG.debugf("Group %s not found in Alfresco", groupId);
                        return null;
                    }
                    throw ex;
                })
                .flatMap(response -> {
                    if (response == null) {
                        return Uni.createFrom().item(people);
                    }
                    List<AlfrescoGroupMemberEntry> entries = response.unwrap();
                    Uni<Map<String, AlfrescoGroupMemberEntry>> chain =
                            collectEntries(entries, visitedGroups, people);
                    if (entries.size() < MAX_PAGE_SIZE) {
                        return chain;
                    }
                    return chain.flatMap(collected -> collectGroupPage(
                            groupId, skipCount + MAX_PAGE_SIZE, visitedGroups, collected));
                });
    }

    private Uni<Map<String, AlfrescoGroupMemberEntry>> collectEntries(
            List<AlfrescoGroupMemberEntry> entries,
            Set<String> visitedGroups,
            Map<String, AlfrescoGroupMemberEntry> people) {
        Uni<Map<String, AlfrescoGroupMemberEntry>> chain = Uni.createFrom().item(people);
        for (AlfrescoGroupMemberEntry entry : entries) {
            if ("PERSON".equalsIgnoreCase(entry.memberType())) {
                people.putIfAbsent(entry.id(), entry);
            } else if ("GROUP".equalsIgnoreCase(entry.memberType())) {
                chain = chain.flatMap(collected -> collectGroupMembers(
                        entry.id(), visitedGroups, collected));
            }
        }
        return chain;
    }

    private Uni<List<AlfrescoPerson>> hydrateMembers(
            Map<String, AlfrescoGroupMemberEntry> members) {
        Uni<List<AlfrescoPerson>> chain = Uni.createFrom().item(new ArrayList<>());
        for (AlfrescoGroupMemberEntry member : members.values()) {
            chain = chain.flatMap(list -> hydrateMember(member)
                    .map(person -> {
                        list.add(person);
                        return list;
                    }));
        }
        return chain.map(List::copyOf);
    }

    private static List<AlfrescoPerson> page(
            List<AlfrescoPerson> members, int maxItems, int skipCount) {
        if (skipCount >= members.size()) {
            return List.of();
        }
        int end = Math.min(skipCount + maxItems, members.size());
        return List.copyOf(members.subList(skipCount, end));
    }

    private Uni<AlfrescoPerson> hydrateMember(AlfrescoGroupMemberEntry member) {
        return coreApi.getPerson(member.id())
                .map(wrap -> toDomain(wrap.entry()))
                .onFailure(AlfrescoClientException.class).recoverWithItem(e -> {
                    LOG.debugf("Failed to hydrate person %s: %s", member.id(), e.getMessage());
                    return new AlfrescoPerson(
                            member.id(),
                            member.id(),
                            null,
                            null,
                            member.displayName());
                });
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

    private static int sanitizeMaxItems(int maxItems) {
        return Math.clamp(maxItems, 0, MAX_PAGE_SIZE);
    }

    private static int sanitizeSkipCount(int skipCount) {
        return Math.clamp(skipCount, 0, Integer.MAX_VALUE);
    }
}
