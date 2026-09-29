package com.microboxlabs.miot.core.selectable;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import io.agroal.api.AgroalDataSource;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import javax.sql.DataSource;

/**
 * The people in the tenant's organizations, for fields such as "responsible".
 * Several organizations can share a tenant, so this is everyone in any of the
 * tenant's active organizations' Alfresco groups, once each. The value is the
 * person id, which is their email.
 *
 * <p>A field asks again as the user types, so the roster is kept for
 * {@link #KEEP} instead of asking Alfresco on every keystroke.
 *
 * <p>{@code @Singleton}, not {@code @ApplicationScoped}: a client proxy needs a
 * no-args constructor, and {@link ListedSystemSource} has none.
 */
@Singleton
class MemberSource extends ListedSystemSource {

    static final String ID = "core.members";
    static final Duration KEEP = Duration.ofMinutes(1);
    private static final int PAGE = 50;
    private static final Duration ALFRESCO_TIMEOUT = Duration.ofSeconds(15);
    private static final String GROUPS_SQL = """
            SELECT alfresco_group_id FROM miot_core.organizations
            WHERE tenant_client_id = ? AND active AND alfresco_group_id IS NOT NULL
            ORDER BY id""";

    private final Function<String, List<String>> groupsOf;
    private final IAlfrescoDirectoryClient directory;
    private final Clock clock;
    private final Map<String, Roster> rosters = new ConcurrentHashMap<>();

    private record Roster(List<SelectableOption> options, Instant until) {
    }

    @Inject
    MemberSource(AgroalDataSource dataSource, IAlfrescoDirectoryClient directory) {
        this(tenant -> groupsOf(dataSource, tenant), directory, Clock.systemUTC());
    }

    MemberSource(Function<String, List<String>> groupsOf, IAlfrescoDirectoryClient directory, Clock clock) {
        super(ID, Localized.of("Miembros de la organización", "Organization members"),
                Localized.of("Las personas de la organización.", "The people in the organization."));
        this.groupsOf = groupsOf;
        this.directory = directory;
        this.clock = clock;
    }

    @Override
    protected List<SelectableOption> all(String tenantCode) {
        Instant now = clock.instant();
        Roster kept = rosters.get(tenantCode);
        if (kept != null && now.isBefore(kept.until())) {
            return kept.options();
        }
        List<SelectableOption> options = load(tenantCode);
        rosters.put(tenantCode, new Roster(options, now.plus(KEEP)));
        return options;
    }

    private List<SelectableOption> load(String tenantCode) {
        Map<String, AlfrescoPerson> people = new LinkedHashMap<>();
        for (String group : groupsOf.apply(tenantCode)) {
            for (int skip = 0; ; skip += PAGE) {
                List<AlfrescoPerson> page;
                try {
                    page = directory.listGroupMembers(group, PAGE, skip).await().atMost(ALFRESCO_TIMEOUT);
                } catch (RuntimeException e) {
                    throw new SourceUnavailableException("could not list the members of " + group, e);
                }
                page.forEach(p -> people.putIfAbsent(p.id(), p));
                if (page.size() < PAGE) {
                    break;
                }
            }
        }
        return people.values().stream()
                .map(MemberSource::toOption)
                .sorted((a, b) -> a.label().get("es").compareToIgnoreCase(b.label().get("es")))
                .toList();
    }

    static SelectableOption toOption(AlfrescoPerson person) {
        String name = name(person);
        String email = person.email() == null ? "" : person.email();
        SelectableOption option = SelectableOption.of(person.id(), name, name);
        return email.isBlank() || email.equals(name) ? option : option.withDescription(email, email);
    }

    /** The display name, else first and last name, else the id. */
    private static String name(AlfrescoPerson person) {
        if (person.displayName() != null && !person.displayName().isBlank()) {
            return person.displayName().trim();
        }
        String full = ((person.firstName() == null ? "" : person.firstName()) + " "
                + (person.lastName() == null ? "" : person.lastName())).trim();
        return full.isEmpty() ? person.id() : full;
    }

    static List<String> groupsOf(DataSource dataSource, String tenantCode) {
        try (Connection c = dataSource.getConnection(); PreparedStatement ps = c.prepareStatement(GROUPS_SQL)) {
            ps.setString(1, tenantCode);
            List<String> groups = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    groups.add(rs.getString(1));
                }
            }
            return groups;
        } catch (SQLException e) {
            throw new SourceUnavailableException("could not read the organizations of tenant " + tenantCode, e);
        }
    }
}
