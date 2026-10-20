package com.microboxlabs.miot.core.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import java.lang.reflect.Proxy;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class MemberSourceTest {

    private static final String TENANT = "tenant-a";
    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");

    /** Answers a fixed roster for {@link #TENANT} and counts every read. */
    static class FakeMembers implements Function<String, List<AlfrescoPerson>> {
        final List<AlfrescoPerson> people;
        int calls;

        FakeMembers(List<AlfrescoPerson> people) {
            this.people = people;
        }

        @Override
        public List<AlfrescoPerson> apply(String tenant) {
            calls++;
            return TENANT.equals(tenant) ? people : List.of();
        }
    }

    private static AlfrescoPerson person(String email, String display, String first, String last) {
        return new AlfrescoPerson(email, email, first, last, display);
    }

    private static List<SelectableOption> options(MemberSource source, String search) {
        return options(source, TENANT, search);
    }

    private static List<SelectableOption> options(MemberSource source, String tenant, String search) {
        return source.options(tenant, SelectableSource.system(MemberSource.ID),
                new SelectableOptionSource.Query(search, List.of(), 500));
    }

    @Test
    void listsTheTenantsMembersByName() {
        FakeMembers members = new FakeMembers(List.of(person("zoe@example.com", null, "Zoe", "Díaz"),
                person("ana@example.com", "Ana Pérez", "Ana", "Pérez"), person("bot@example.com", "", null, null)));

        List<SelectableOption> all = options(new MemberSource(members, Clock.fixed(NOW, ZoneOffset.UTC)), null);

        assertEquals(List.of("ana@example.com", "bot@example.com", "zoe@example.com"),
                all.stream().map(SelectableOption::value).toList());
        assertEquals(List.of("Ana Pérez", "bot@example.com", "Zoe Díaz"),
                all.stream().map(o -> o.label().get("en")).toList());
        assertEquals(Map.of("es", "ana@example.com", "en", "ana@example.com"), all.get(0).description());
        assertEquals(Map.of(), all.get(1).description(), "no email line when the name already is the email");
    }

    @Test
    void searchesNames() {
        FakeMembers members = new FakeMembers(IntStream.range(0, 120)
                .mapToObj(i -> person("p" + i + "@example.com", "Persona " + i, null, null)).toList());
        MemberSource source = new MemberSource(members, Clock.fixed(NOW, ZoneOffset.UTC));

        assertEquals(120, options(source, null).size());
        assertEquals(List.of("p42@example.com"),
                options(source, "persona 42").stream().map(SelectableOption::value).toList());
    }

    @Test
    void readsTheRosterAgainOnlyAfterAMinute() {
        FakeMembers members = new FakeMembers(List.of(person("ana@example.com", "Ana", null, null)));
        MutableClock clock = new MutableClock(NOW);
        MemberSource source = new MemberSource(members, clock);

        options(source, null);
        options(source, "an");
        int afterTwoReads = members.calls;
        clock.now = NOW.plus(MemberSource.KEEP);
        options(source, null);

        assertEquals(1, afterTwoReads, "the second read uses the kept roster");
        assertEquals(2, members.calls);
    }

    @Test
    void aTenantWithNoOrganizationsHasNoOne() {
        FakeMembers members = new FakeMembers(List.of(person("ana@example.com", "Ana", null, null)));

        assertEquals(List.of(), options(new MemberSource(members, Clock.fixed(NOW, ZoneOffset.UTC)), "other", null));
    }

    @Test
    void aDatabaseFailureIsReportedNotAnEmptyList() {
        DataSource down = (DataSource) Proxy.newProxyInstance(DataSource.class.getClassLoader(),
                new Class<?>[] {DataSource.class}, (proxy, method, args) -> {
                    throw new SQLException("connection refused");
                });

        assertThrows(SourceUnavailableException.class, () -> MemberSource.membersOf(down, TENANT));
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
