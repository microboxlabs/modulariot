package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.*;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class NotificationRecipientsTest {

    private static final class Recipients extends NotificationRecipients {
        String sql;
        Tuple params;
        List<Row> rows = List.of();

        Recipients(List<String> owners) {
            super(null, new PlatformAuthorizer(Optional.of(owners), null));
        }

        @Override
        protected RowSet<Row> execute(String query, Tuple values) {
            sql = query;
            params = values;
            return rows(rows);
        }
    }

    @Test
    void resolvesDatabaseAndConfiguredOwnersWithDisabledUsersExcluded() {
        var recipients = new Recipients(List.of(" Owner@Example.com ", "owner@example.com"));
        recipients.rows = List.of(row(Map.of("email", "owner@example.com")), row(Map.of("email", "grant@example.com")));
        assertEquals(List.of("owner@example.com", "grant@example.com"), recipients.platformOwners());
        assertArrayEquals(new String[]{"owner@example.com"}, recipients.params.getArrayOfStrings(0));
        assertTrue(recipients.sql.contains("role_code = 'PLATFORM_OWNER'"));
        assertTrue(recipients.sql.contains("u.status = 'ACTIVE'"));
        assertTrue(recipients.sql.contains("UNION SELECT unnest($1::text[])"));
    }

    @Test
    void resolvesOnlyActiveOwnerAndAdminMembershipsOnTheOrganization() {
        var recipients = new Recipients(List.of());
        recipients.rows = List.of(row(Map.of("id", 7L, "slug", "example-org", "name", "Example",
                "tenant_client_id", "tenant-1", "emails", new String[]{"admin@example.com", "owner@example.com"})));
        var audience = recipients.organizationAdmins("example-org");
        assertEquals(7L, audience.id());
        assertEquals("tenant-1", audience.tenantCode());
        assertEquals(List.of("admin@example.com", "owner@example.com"), audience.emails());
        assertEquals("example-org", recipients.params.getString(0));
        assertTrue(recipients.sql.contains("m.base_role IN ('OWNER', 'ADMIN')"));
        assertTrue(recipients.sql.contains("m.status = 'ACTIVE'"));
        assertTrue(recipients.sql.contains("u.status = 'ACTIVE'"));
        assertTrue(recipients.sql.contains("o.slug = $1 AND o.active AND o.parent_id IS NULL"));
    }

    @Test
    void emptyOwnerAndAdminListsAreValid() {
        var recipients = new Recipients(List.of());
        assertEquals(List.of(), recipients.platformOwners());
        recipients.rows = List.of(row(Map.of("id", 7L, "slug", "example-org", "name", "Example",
                "tenant_client_id", "tenant-1")));
        assertEquals(List.of(), recipients.organizationAdmins("example-org").emails());
    }

    @Test
    void missingOrganizationDoesNotCreateAClaimWithAnIncompleteAudience() {
        var recipients = new Recipients(List.of());
        assertThrows(IllegalArgumentException.class, () -> recipients.organizationAdmins("missing"));
    }

    private static Row row(Map<String, Object> values) {
        var delegate = (io.vertx.sqlclient.Row) Proxy.newProxyInstance(Row.class.getClassLoader(),
                new Class<?>[]{io.vertx.sqlclient.Row.class}, (proxy, method, args) -> values.get((String) args[0]));
        return Row.newInstance(delegate);
    }

    @SuppressWarnings("unchecked")
    private static RowSet<Row> rows(List<Row> values) {
        var delegateRows = values.stream().map(Row::getDelegate).toList();
        var delegate = (io.vertx.sqlclient.RowSet<io.vertx.sqlclient.Row>) Proxy.newProxyInstance(RowSet.class.getClassLoader(),
                new Class<?>[]{io.vertx.sqlclient.RowSet.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "iterator" -> iterator(delegateRows);
                    case "size", "rowCount" -> delegateRows.size();
                    default -> null;
                });
        return RowSet.newInstance(delegate, Row.__TYPE_ARG);
    }

    private static io.vertx.sqlclient.RowIterator<io.vertx.sqlclient.Row> iterator(List<io.vertx.sqlclient.Row> values) {
        var iterator = values.iterator();
        return new io.vertx.sqlclient.RowIterator<>() {
            public boolean hasNext() { return iterator.hasNext(); }
            public io.vertx.sqlclient.Row next() { return iterator.next(); }
        };
    }
}
