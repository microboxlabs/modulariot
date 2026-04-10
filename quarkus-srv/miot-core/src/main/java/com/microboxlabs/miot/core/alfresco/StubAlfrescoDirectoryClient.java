package com.microboxlabs.miot.core.alfresco;

import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import org.jboss.logging.Logger;

/**
 * Stub implementation of {@link IAlfrescoDirectoryClient}. Returns a small
 * canned set of people so the admin UI can be exercised end-to-end before
 * the real Alfresco REST client lands. Replaced by the real implementation
 * via CDI override (a non-{@code @DefaultBean} implementation wins).
 */
@ApplicationScoped
@DefaultBean
public class StubAlfrescoDirectoryClient implements IAlfrescoDirectoryClient {

    private static final Logger LOG = Logger.getLogger(StubAlfrescoDirectoryClient.class);

    private static final List<AlfrescoPerson> SAMPLE_PEOPLE = List.of(
            new AlfrescoPerson(
                    "dev.user@example.com",
                    "dev.user@example.com",
                    "Dev",
                    "User",
                    "Dev User"),
            new AlfrescoPerson(
                    "cris.perez@example.com",
                    "cris.perez@example.com",
                    "Cris",
                    "Pérez",
                    "Cris Pérez"),
            new AlfrescoPerson(
                    "ana.soto@example.com",
                    "ana.soto@example.com",
                    "Ana",
                    "Soto",
                    "Ana Soto"));

    @Override
    public Uni<List<AlfrescoPerson>> listGroupMembers(String groupId, int maxItems, int skipCount) {
        LOG.warnf("STUB: listGroupMembers(%s, max=%d, skip=%d) — returning sample people",
                groupId, maxItems, skipCount);
        return Uni.createFrom().item(SAMPLE_PEOPLE);
    }

    @Override
    public Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems) {
        LOG.warnf("STUB: searchPeople(%s, max=%d) — returning filtered sample", query, maxItems);
        if (query == null || query.isBlank()) {
            return Uni.createFrom().item(SAMPLE_PEOPLE);
        }
        String needle = query.toLowerCase();
        List<AlfrescoPerson> matches = SAMPLE_PEOPLE.stream()
                .filter(p -> p.displayName().toLowerCase().contains(needle)
                        || p.email().toLowerCase().contains(needle)
                        || p.firstName().toLowerCase().contains(needle)
                        || p.lastName().toLowerCase().contains(needle))
                .limit(Math.max(1, maxItems))
                .toList();
        return Uni.createFrom().item(matches);
    }
}
