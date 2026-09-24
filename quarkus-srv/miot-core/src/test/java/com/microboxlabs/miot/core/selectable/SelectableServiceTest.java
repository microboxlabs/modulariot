package com.microboxlabs.miot.core.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.api.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.core.api.dto.SelectableRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SelectableServiceTest {

    private static final String TENANT = "tenant-a";

    private final List<SelectableChanged> events = new ArrayList<>();
    private SelectableService service;

    @BeforeEach
    void setUp() {
        SelectableDefaults reasons = tenant -> List.of(list(tenant, "reason", SelectionMode.SINGLE, "r_1", "r_2"));
        SelectableDefaults tags = tenant -> List.of(list(tenant, "tags", SelectionMode.MULTIPLE, "t_1"));
        service = new SelectableService(new InMemorySelectableStore(), List.of(reasons, tags), events::add);
    }

    @Test
    void firstListSeedsEveryProvidersDefaults() {
        List<Selectable> listed = service.list(TENANT);

        assertEquals(List.of("reason", "tags"), listed.stream().map(Selectable::key).toList());
        assertEquals(List.of("r_1", "r_2"), listed.get(0).options().stream().map(SelectableOption::id).toList());
        assertEquals(SelectionMode.MULTIPLE, listed.get(1).mode());
        assertTrue(events.isEmpty());
    }

    @Test
    void noProviderMeansNoLists() {
        SelectableService bare = new SelectableService(new InMemorySelectableStore(), List.of(), events::add);

        assertTrue(bare.list(TENANT).isEmpty());
    }

    @Test
    void deletingEverythingDoesNotReseedButResetDoes() {
        service.list(TENANT).forEach(s -> service.delete(TENANT, "o", s.key()));
        assertTrue(service.list(TENANT).isEmpty());

        assertEquals(2, service.reset(TENANT, "o").size());
        assertFalse(service.delete(TENANT, "o", "never_existed"));
        assertEquals(List.of("selectable.deleted", "selectable.deleted", "selectable.reset"),
                events.stream().map(SelectableChanged::action).toList());
    }

    @Test
    void replaceKeepsGivenIdsAssignsMissingOnesAndRejectsBadInput() {
        Selectable saved = service.replace(TENANT, "o", "sel_abc1234", new SelectableRequest("Mi lista", null,
                SelectionMode.SINGLE, List.of(new SelectableOption("opt_keep", "A", ""),
                        new SelectableOption(null, "B", null))));

        assertEquals("opt_keep", saved.options().get(0).id());
        assertTrue(saved.options().get(1).id().startsWith("opt_"));
        assertEquals(new SelectableChanged(TENANT, "o", "selectable.replaced", "sel_abc1234",
                Map.of("name", "Mi lista", "options", 2)), events.get(0));
        SelectableRequest valid = new SelectableRequest("x", null, SelectionMode.SINGLE, List.of());
        SelectableRequest duplicateIds = new SelectableRequest("x", null, SelectionMode.SINGLE,
                List.of(new SelectableOption("d", "a", ""), new SelectableOption("d", "b", "")));
        SelectableRequest noMode = new SelectableRequest("x", null, null, List.of());

        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "x", valid));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", duplicateIds));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", noMode));
        assertThrows(NoSuchElementException.class, () -> service.get(TENANT, "missing_key"));
    }

    @Test
    void bindingsMustPointAtAnExistingSelectableAndGoWithIt() {
        assertEquals("tags",
                service.updateBindings(TENANT, "o", new SelectableBindingsRequest(Map.of("who_to_call", "tags")))
                        .get("who_to_call"));
        SelectableBindingsRequest unknown = new SelectableBindingsRequest(Map.of("who_to_call", "missing_list"));
        assertThrows(IllegalArgumentException.class, () -> service.updateBindings(TENANT, "o", unknown));

        service.delete(TENANT, "o", "tags");

        assertTrue(service.bindings(TENANT).isEmpty());
    }

    @Test
    void tenantsDoNotSeeEachOthersLists() {
        service.replace(TENANT, "o", "only_a", new SelectableRequest("A", null, SelectionMode.SINGLE, List.of()));

        assertEquals(List.of("reason", "tags"), service.list("tenant-b").stream().map(Selectable::key).toList());
    }

    @Test
    void aDeleteThatRacesABindingNeverLeavesTheBindingDangling() throws Exception {
        CountDownLatch validated = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        SelectableStore pausingBind = new InMemorySelectableStore() {
            @Override
            public void bind(String tenantCode, String fieldKey, String selectableKey) {
                validated.countDown();
                await(release);
                super.bind(tenantCode, fieldKey, selectableKey);
            }
        };
        SelectableService racing = new SelectableService(pausingBind,
                List.of(tenant -> List.of(list(tenant, "tags", SelectionMode.MULTIPLE, "t_1"))), events::add);
        racing.list(TENANT);
        SelectableBindingsRequest bindToTags = new SelectableBindingsRequest(Map.of("who_to_call", "tags"));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> binding = pool.submit(() -> racing.updateBindings(TENANT, "o", bindToTags));
            assertTrue(validated.await(5, TimeUnit.SECONDS), "binding passed validation");
            Future<?> deleting = pool.submit(() -> racing.delete(TENANT, "o", "tags"));
            // Give the delete time to run while the binding is paused between validation and write.
            Thread.sleep(300);
            release.countDown();
            binding.get(5, TimeUnit.SECONDS);
            deleting.get(5, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        Set<String> lists = racing.list(TENANT).stream().map(Selectable::key).collect(Collectors.toSet());
        racing.bindings(TENANT).forEach((field, key) ->
                assertTrue(lists.contains(key), field + " is bound to the deleted list " + key));
    }

    @Test
    void aFailingDefaultsProviderLeavesTheListsAsTheyWere() {
        AtomicBoolean failing = new AtomicBoolean(false);
        SelectableDefaults reasons = tenant -> List.of(list(tenant, "reason", SelectionMode.SINGLE, "r_1"));
        SelectableDefaults flaky = tenant -> {
            if (failing.get()) {
                throw new IllegalStateException("provider down");
            }
            return List.of();
        };
        SelectableService flakyService = new SelectableService(new InMemorySelectableStore(),
                List.of(reasons, flaky), events::add);
        flakyService.replace(TENANT, "o", "custom", new SelectableRequest("Mine", null, SelectionMode.SINGLE,
                List.of()));
        failing.set(true);

        assertThrows(IllegalStateException.class, () -> flakyService.reset(TENANT, "o"));

        assertEquals(List.of("reason", "custom"),
                flakyService.list(TENANT).stream().map(Selectable::key).toList());
    }

    @Test
    void aProviderFailureOnFirstReadIsRetriedOnTheNextOne() {
        AtomicBoolean failing = new AtomicBoolean(true);
        SelectableDefaults reasons = tenant -> List.of(list(tenant, "reason", SelectionMode.SINGLE, "r_1"));
        SelectableDefaults flaky = tenant -> {
            if (failing.get()) {
                throw new IllegalStateException("provider down");
            }
            return List.of(list(tenant, "tags", SelectionMode.MULTIPLE, "t_1"));
        };
        SelectableService flakyService = new SelectableService(new InMemorySelectableStore(),
                List.of(reasons, flaky), events::add);

        assertThrows(IllegalStateException.class, () -> flakyService.list(TENANT));
        failing.set(false);

        assertEquals(List.of("reason", "tags"), flakyService.list(TENANT).stream().map(Selectable::key).toList());
    }

    @Test
    void defaultsAlwaysLandInTheTenantBeingSeeded() {
        SelectableDefaults careless = tenant -> List.of(list("tenant-b", "reason", SelectionMode.SINGLE, "r_1"));
        SelectableService carelessService = new SelectableService(new InMemorySelectableStore(),
                List.of(careless), events::add);

        List<Selectable> seededForA = carelessService.list(TENANT);

        assertEquals(List.of(TENANT), seededForA.stream().map(Selectable::tenantCode).toList());
        assertEquals(List.of(TENANT), carelessService.reset(TENANT, "o").stream().map(Selectable::tenantCode).toList());
        assertTrue(carelessService.bindings("tenant-b").isEmpty());
        assertEquals(List.of("reason"), carelessService.list("tenant-b").stream().map(Selectable::key).toList());
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static Selectable list(String tenant, String key, SelectionMode mode, String... ids) {
        List<SelectableOption> options = new ArrayList<>();
        for (String id : ids) {
            options.add(new SelectableOption(id, id.toUpperCase(), ""));
        }
        return new Selectable(tenant, key, key, "", mode, options, "system:defaults", null);
    }
}
