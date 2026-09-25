package com.microboxlabs.miot.core.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.api.dto.SelectableRequest;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
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
        List<SelectableOption> options = List.of(
                SelectableOption.of("o_1", "A", "A").withGroup("g").withLook("red", "hi2-truck")
                        .withDescription("uno", "one"),
                SelectableOption.of("o_2", "B", "B").withParent("CL-RM").asDisabled());
        SelectableSettings settings = new SelectableSettings(false, true, "second", 2, Localized.of("Elige", "Pick"));
        Selectable replaced = store.upsert(new Selectable(tenant, "first", Localized.of("Renombrada", "Renamed"),
                Map.of(), SelectionMode.MULTIPLE, settings, List.of(SelectableGroup.of("g", "Grupo", "Group")),
                SelectableSource.STATIC, options, "o", null));

        assertNotNull(replaced.updatedAt());
        assertEquals(List.of("first", "second"), store.list(tenant).stream().map(Selectable::key).toList());
        Selectable found = store.find(tenant, "first").orElseThrow();
        assertEquals(Localized.of("Renombrada", "Renamed"), found.name());
        assertEquals(SelectionMode.MULTIPLE, found.mode());
        assertEquals(settings, found.settings());
        assertEquals(List.of(SelectableGroup.of("g", "Grupo", "Group")), found.groups());
        assertEquals(options, found.options());
        store.upsert(list(tenant, "dynamic", "Zonas").withSource(SelectableSource.system("core.timezones")));
        assertEquals(SelectableSource.system("core.timezones"), store.find(tenant, "dynamic").orElseThrow().source());
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

    /** Each call takes its own connection, as two replicas would. */
    @Test
    void aSecondCallerWaitsForTheTenantLockAndAnotherTenantDoesNot() throws Exception {
        CountDownLatch holding = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CompletableFuture<Void> first = CompletableFuture.runAsync(() -> store.locked(tenant, () -> {
            holding.countDown();
            await(release);
            return null;
        }));
        assertTrue(holding.await(5, TimeUnit.SECONDS), "the first caller holds the lock");

        CompletableFuture<String> second = CompletableFuture.supplyAsync(() -> store.locked(tenant, () -> "second"));
        assertEquals("other", store.locked(tenant + "-other", () -> "other"));
        assertThrows(TimeoutException.class, () -> second.get(500, TimeUnit.MILLISECONDS));

        release.countDown();
        first.get(5, TimeUnit.SECONDS);
        assertEquals("second", second.get(5, TimeUnit.SECONDS));
    }

    @Test
    void aFailingCallerReleasesTheLock() {
        assertThrows(IllegalStateException.class, () -> store.locked(tenant, () -> {
            throw new IllegalStateException("boom");
        }));

        assertEquals("next", store.locked(tenant, () -> "next"));
    }

    /** Store calls inside the lock run on its connection, so they commit or roll back with it. */
    @Test
    void writesInsideTheLockRollBackTogetherWhenItFails() {
        store.upsert(list(tenant, "kept", "Kept"));

        assertThrows(IllegalStateException.class, () -> store.locked(tenant, () -> {
            store.upsert(list(tenant, "half_done", "Half"));
            store.delete(tenant, "kept");
            store.bindAll(tenant, Map.of("why", "half_done"));
            throw new IllegalStateException("fails after writing");
        }));

        assertEquals(List.of("kept"), store.list(tenant).stream().map(Selectable::key).toList());
        assertTrue(store.bindings(tenant).isEmpty());
    }

    /** A first write that fails validation must not undo the seeding it triggered. */
    @Test
    void aRejectedFirstWriteKeepsTheSeededDefaults() {
        SelectableService service = new SelectableService(store,
                List.of(t -> List.of(list(t, "reasons", "Motivos"))), e -> { });
        SelectableRequest onMissing = new SelectableRequest(Map.of("es", "Sub"), null, SelectionMode.SINGLE,
                SelectableSettings.dependingOn("missing_list"), null, null, List.of());

        assertThrows(IllegalArgumentException.class, () -> service.replace(tenant, "o", "sub", onMissing));

        assertEquals(List.of("reasons"), service.list(tenant).stream().map(Selectable::key).toList());
        assertTrue(store.isSeeded(tenant));
    }

    @Test
    void writesInsideTheLockCommitWhenItSucceeds() {
        store.locked(tenant, () -> {
            store.seed(tenant, List.of(list(tenant, "reasons", "Motivos")));
            store.upsert(list(tenant, "extra", "Extra"));
            return null;
        });

        assertEquals(List.of("reasons", "extra"), store.list(tenant).stream().map(Selectable::key).toList());
        assertTrue(store.isSeeded(tenant));
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static Selectable list(String tenant, String key, String name) {
        return Selectable.of(key, name, name, "", "", SelectionMode.SINGLE,
                List.of(SelectableOption.of("opt_1", "Uno", "One"))).forTenant(tenant);
    }
}
