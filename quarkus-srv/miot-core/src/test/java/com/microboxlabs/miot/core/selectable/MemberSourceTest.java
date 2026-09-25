package com.microboxlabs.miot.core.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import io.smallrye.mutiny.Uni;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class MemberSourceTest {

    private static final String TENANT = "tenant-a";
    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");

    /** Groups answer from a fixed roster, paged like Alfresco, and count every call. */
    static class FakeDirectory implements IAlfrescoDirectoryClient {
        final Map<String, List<AlfrescoPerson>> groups;
        int calls;

        FakeDirectory(Map<String, List<AlfrescoPerson>> groups) {
            this.groups = groups;
        }

        @Override
        public Uni<List<AlfrescoPerson>> listGroupMembers(String groupId, int maxItems, int skipCount) {
            calls++;
            List<AlfrescoPerson> all = groups.getOrDefault(groupId, List.of());
            return Uni.createFrom().item(all.subList(Math.min(skipCount, all.size()),
                    Math.min(skipCount + maxItems, all.size())));
        }

        @Override
        public Uni<String> getSiteRole(String personId, String siteId) {
            return Uni.createFrom().nullItem();
        }

        @Override
        public Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems) {
            return Uni.createFrom().item(List.of());
        }
    }

    private static AlfrescoPerson person(String email, String display, String first, String last) {
        return new AlfrescoPerson(email, email, first, last, display);
    }

    private static MemberSource source(FakeDirectory directory, Clock clock) {
        return new MemberSource(tenant -> TENANT.equals(tenant) ? List.of("GROUP_a", "GROUP_b") : List.of(),
                directory, clock);
    }

    private static List<SelectableOption> options(MemberSource source, String search) {
        return source.options(TENANT, SelectableSource.system(MemberSource.ID),
                new SelectableOptionSource.Query(search, List.of(), 500));
    }

    @Test
    void listsEveryoneInTheTenantsOrganizationsOnceByName() {
        AlfrescoPerson ana = person("ana@example.com", "Ana Pérez", "Ana", "Pérez");
        FakeDirectory directory = new FakeDirectory(Map.of(
                "GROUP_a", List.of(person("zoe@example.com", null, "Zoe", "Díaz"), ana),
                "GROUP_b", List.of(ana, person("bot@example.com", "", null, null))));

        List<SelectableOption> all = options(source(directory, Clock.fixed(NOW, ZoneOffset.UTC)), null);

        assertEquals(List.of("ana@example.com", "bot@example.com", "zoe@example.com"),
                all.stream().map(SelectableOption::value).toList());
        assertEquals(List.of("Ana Pérez", "bot@example.com", "Zoe Díaz"),
                all.stream().map(o -> o.label().get("en")).toList());
        assertEquals(Map.of("es", "ana@example.com", "en", "ana@example.com"), all.get(0).description());
        assertEquals(Map.of(), all.get(1).description(), "no email line when the name already is the email");
    }

    @Test
    void readsPastTheFirstPageAndSearchesNames() {
        List<AlfrescoPerson> many = IntStream.range(0, 120)
                .mapToObj(i -> person("p" + i + "@example.com", "Persona " + i, null, null)).toList();
        FakeDirectory directory = new FakeDirectory(Map.of("GROUP_a", many));
        MemberSource source = source(directory, Clock.fixed(NOW, ZoneOffset.UTC));

        assertEquals(120, options(source, null).size());
        assertEquals(List.of("p42@example.com"),
                options(source, "persona 42").stream().map(SelectableOption::value).toList());
    }

    @Test
    void asksAlfrescoAgainOnlyAfterAMinute() {
        FakeDirectory directory = new FakeDirectory(Map.of("GROUP_a",
                List.of(person("ana@example.com", "Ana", null, null))));
        MutableClock clock = new MutableClock(NOW);
        MemberSource source = source(directory, clock);

        options(source, null);
        options(source, "an");
        int afterTwoReads = directory.calls;
        clock.now = NOW.plus(MemberSource.KEEP);
        options(source, null);

        assertEquals(2, afterTwoReads, "one call per group, then the kept roster");
        assertEquals(4, directory.calls);
    }

    @Test
    void aTenantWithNoOrganizationsHasNoOne() {
        FakeDirectory directory = new FakeDirectory(Map.of());
        MemberSource source = source(directory, Clock.fixed(NOW, ZoneOffset.UTC));

        assertEquals(List.of(), source.options("other", SelectableSource.system(MemberSource.ID),
                new SelectableOptionSource.Query(null, List.of(), 10)));
        assertEquals(0, directory.calls);
    }

    @Test
    void anAlfrescoFailureIsReportedNotAnEmptyList() {
        FakeDirectory down = new FakeDirectory(Map.of()) {
            @Override
            public Uni<List<AlfrescoPerson>> listGroupMembers(String groupId, int maxItems, int skipCount) {
                return Uni.createFrom().failure(new IllegalStateException("503"));
            }
        };

        assertThrows(SourceUnavailableException.class,
                () -> options(source(down, Clock.fixed(NOW, ZoneOffset.UTC)), null));
    }

    static final class MutableClock extends Clock {
        Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
