package com.microboxlabs.miot.core.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The Postgres store against the real migration: what the in-memory one used to lose on restart. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class JdbcSelectableStoreTest {

    @Inject
    SelectableStore store;

    @Inject
    AgroalDataSource ds;

    private String tenant;

    @BeforeEach
    void freshTenant() {
        tenant = "sel-test-" + UUID.randomUUID();
    }

    /** Bindings go with their lists (ON DELETE CASCADE). */
    @AfterEach
    void removeTenant() throws SQLException {
        try (Connection c = ds.getConnection()) {
            for (String table : List.of("selectables", "selectable_tenants")) {
                try (PreparedStatement st = c.prepareStatement(
                        "DELETE FROM miot_core." + table + " WHERE tenant_code LIKE ?")) {
                    st.setString(1, tenant + "%");
                    st.executeUpdate();
                }
            }
        }
    }

    @Test
    void theBeanIsThePostgresStore() {
        assertInstanceOf(JdbcSelectableStore.class, store);
    }

    @Test
    void aListRoundTripsAndKeepsItsPlaceWhenReplaced() {
        store.upsert(list(tenant, "first", "Uno"));
        store.upsert(list(tenant, "second", "Dos"));
        Selectable replaced = store.upsert(new Selectable(tenant, "first", "Renamed", null, SelectionMode.MULTIPLE,
                List.of(new SelectableOption("o_1", "A", "a"), new SelectableOption("o_2", "B", "")), "o", null));

        assertNotNull(replaced.updatedAt());
        assertEquals(List.of("first", "second"), store.list(tenant).stream().map(Selectable::key).toList());
        Selectable found = store.find(tenant, "first").orElseThrow();
        assertEquals("Renamed", found.name());
        assertEquals(SelectionMode.MULTIPLE, found.mode());
        assertEquals(List.of(new SelectableOption("o_1", "A", "a"), new SelectableOption("o_2", "B", "")),
                found.options());
        assertTrue(store.find(tenant, "missing").isEmpty());
        assertTrue(store.list(tenant + "-other").isEmpty());
    }

    @Test
    void deletingAListDropsItsBindings() {
        store.upsert(list(tenant, "reasons", "Motivos"));
        store.upsert(list(tenant, "tags", "Tags"));
        store.bindAll(tenant, Map.of("why", "reasons", "labels", "tags"));

        assertTrue(store.delete(tenant, "reasons"));
        assertFalse(store.delete(tenant, "reasons"));

        assertEquals(Map.of("labels", "tags"), store.bindings(tenant));
    }

    @Test
    void aBindingToAMissingListWritesNoneOfTheBatch() {
        store.upsert(list(tenant, "reasons", "Motivos"));
        Map<String, String> batch = Map.of("why", "reasons", "labels", "never_created");

        assertThrows(IllegalArgumentException.class, () -> store.bindAll(tenant, batch));

        assertTrue(store.bindings(tenant).isEmpty());
    }

    @Test
    void defaultsAreWrittenOnceEvenAfterEveryListIsDeleted() {
        assertFalse(store.isSeeded(tenant));
        store.seed(tenant, List.of(list(tenant, "reasons", "Motivos")));
        store.delete(tenant, "reasons");

        store.seed(tenant, List.of(list(tenant, "reasons", "Motivos")));

        assertTrue(store.isSeeded(tenant));
        assertTrue(store.list(tenant).isEmpty());
    }

    @Test
    void aNewServiceDoesNotReseedATenantThatDeletedItsLists() {
        SelectableDefaults reasons = t -> List.of(list(t, "reasons", "Motivos"));
        SelectableService before = new SelectableService(store, List.of(reasons), e -> { });
        before.list(tenant).forEach(s -> before.delete(tenant, "o", s.key()));

        SelectableService afterRestart = new SelectableService(store, List.of(reasons), e -> { });

        assertTrue(afterRestart.list(tenant).isEmpty());
        assertEquals(List.of("reasons"),
                afterRestart.reset(tenant, "o").stream().map(Selectable::key).toList());
    }

    @Test
    void resetReplacesEveryListAndBinding() {
        store.upsert(list(tenant, "custom", "Mine"));
        store.bindAll(tenant, Map.of("why", "custom"));

        store.resetTo(tenant, List.of(list(tenant, "reasons", "Motivos")));

        assertEquals(List.of("reasons"), store.list(tenant).stream().map(Selectable::key).toList());
        assertTrue(store.bindings(tenant).isEmpty());
        assertTrue(store.isSeeded(tenant));
    }

    private static Selectable list(String tenant, String key, String name) {
        return new Selectable(tenant, key, name, "", SelectionMode.SINGLE,
                List.of(new SelectableOption("opt_1", "Uno", "")), "system:defaults", null);
    }
}
