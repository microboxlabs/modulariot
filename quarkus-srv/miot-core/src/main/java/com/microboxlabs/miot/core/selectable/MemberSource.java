package com.microboxlabs.miot.core.selectable;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.auth.OrganizationMembership;
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
 * tenant's active organizations, once each: the members of the Alfresco group
 * for an organization with Alfresco membership, the memberships for one with
 * native membership. The value is the person id, which is their email.
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
            SELECT o.alfresco_group_id FROM miot_core.organizations o
            LEFT JOIN miot_core.organizations p ON p.id = o.parent_id
            WHERE o.tenant_client_id = ? AND o.active AND o.alfresco_group_id IS NOT NULL
              AND NOT ? AND coalesce(p.membership_source, o.membership_source) = 'ALFRESCO'
            ORDER BY o.id""";
    private static final String NATIVE_MEMBERS_SQL = """
            SELECT DISTINCT u.email, u.name FROM miot_core.organizations o
            LEFT JOIN miot_core.organizations p ON p.id = o.parent_id
            JOIN miot_iam.iam_membership m ON m.organization_id IN (o.id, coalesce(p.id, o.id))
            JOIN miot_iam.iam_user u ON u.id = m.user_id
            WHERE o.tenant_client_id = ? AND o.active AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
              AND (? OR coalesce(p.membership_source, o.membership_source) = 'NATIVE')""";

    private final Function<String, List<String>> groupsOf;
    private final Function<String, List<AlfrescoPerson>> nativeMembersOf;
    private final IAlfrescoDirectoryClient directory;
    private final Clock clock;
    private final Map<String, Roster> rosters = new ConcurrentHashMap<>();

    private record Roster(List<SelectableOption> options, Instant until) {
    }

    @Inject
    MemberSource(AgroalDataSource dataSource, IAlfrescoDirectoryClient directory, OrganizationMembership membership) {
        this(tenant -> groupsOf(dataSource, tenant, membership.isNative()),
                tenant -> nativeMembersOf(dataSource, tenant, membership.isNative()), directory, Clock.systemUTC());
    }

    MemberSource(Function<String, List<String>> groupsOf, Function<String, List<AlfrescoPerson>> nativeMembersOf,
            IAlfrescoDirectoryClient directory, Clock clock) {
        super(ID, Localized.of("Miembros de la organización", "Organization members"),
                Localized.of("Las personas de la organización.", "The people in the organization."));
        this.groupsOf = groupsOf;
        this.nativeMembersOf = nativeMembersOf;
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
        nativeMembersOf.apply(tenantCode).forEach(p -> people.putIfAbsent(p.id(), p));
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

    static List<AlfrescoPerson> nativeMembersOf(DataSource dataSource, String tenantCode, boolean allNative) {
        try (Connection c = dataSource.getConnection();
                PreparedStatement ps = c.prepareStatement(NATIVE_MEMBERS_SQL)) {
            ps.setString(1, tenantCode);
            ps.setBoolean(2, allNative);
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

    static List<String> groupsOf(DataSource dataSource, String tenantCode, boolean allNative) {
        try (Connection c = dataSource.getConnection(); PreparedStatement ps = c.prepareStatement(GROUPS_SQL)) {
            ps.setString(1, tenantCode);
            ps.setBoolean(2, allNative);
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
