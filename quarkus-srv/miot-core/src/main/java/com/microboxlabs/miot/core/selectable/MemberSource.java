package com.microboxlabs.miot.core.selectable;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import javax.sql.DataSource;

/**
 * The people in the tenant's organizations, for fields such as "responsible".
 * Several organizations can share a tenant, so this is everyone with an active
 * membership in any of the tenant's active organizations, once each. The value
 * is the person id, which is their email.
 *
 * <p>A field asks again as the user types, so the roster is kept for
 * {@link #KEEP} instead of reading it on every keystroke.
 *
 * <p>{@code @Singleton}, not {@code @ApplicationScoped}: a client proxy needs a
 * no-args constructor, and {@link ListedSystemSource} has none.
 */
@Singleton
class MemberSource extends ListedSystemSource {

    static final String ID = "core.members";
    static final Duration KEEP = Duration.ofMinutes(1);
    private static final String MEMBERS_SQL = """
            SELECT DISTINCT u.email, u.name FROM miot_core.organizations o
            LEFT JOIN miot_core.organizations p ON p.id = o.parent_id
            JOIN miot_iam.iam_membership m ON m.organization_id IN (o.id, coalesce(p.id, o.id))
            JOIN miot_iam.iam_user u ON u.id = m.user_id
            WHERE o.tenant_client_id = ? AND o.active AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
              AND btrim(u.email) <> ''""";

    private final Function<String, List<AlfrescoPerson>> membersOf;
    private final Clock clock;
    private final Map<String, Roster> rosters = new ConcurrentHashMap<>();

    private record Roster(List<SelectableOption> options, Instant until) {
    }

    @Inject
    MemberSource(AgroalDataSource dataSource) {
        this(tenant -> membersOf(dataSource, tenant), Clock.systemUTC());
    }

    MemberSource(Function<String, List<AlfrescoPerson>> membersOf, Clock clock) {
        super(ID, Localized.of("Miembros de la organización", "Organization members"),
                Localized.of("Las personas de la organización.", "The people in the organization."));
        this.membersOf = membersOf;
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
        return membersOf.apply(tenantCode).stream()
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

    static List<AlfrescoPerson> membersOf(DataSource dataSource, String tenantCode) {
        try (Connection c = dataSource.getConnection(); PreparedStatement ps = c.prepareStatement(MEMBERS_SQL)) {
            ps.setString(1, tenantCode);
            List<AlfrescoPerson> people = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String email = rs.getString(1);
                    people.add(new AlfrescoPerson(email, email, null, null, rs.getString(2)));
                }
            }
            return people;
        } catch (SQLException e) {
            throw new SourceUnavailableException("could not read the members of tenant " + tenantCode, e);
        }
    }
}
