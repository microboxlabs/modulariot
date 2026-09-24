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
        assertEquals(List.of("r_1", "r_2"), listed.get(0).options().stream().map(SelectableOption::value).toList());
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
    void replaceKeepsGivenValuesMakesMissingOnesFromTheLabelAndRejectsBadInput() {
        Selectable saved = service.replace(TENANT, "o", "sel_abc1234", request("Mi lista", SelectionMode.SINGLE,
                List.of(option("keep", "A"), option(null, "Región Sur"), option("", "Región Sur"))));

        assertEquals(List.of("keep", "region_sur", "region_sur_2"),
                saved.options().stream().map(SelectableOption::value).toList());
        assertEquals(Map.of("es", "Mi lista"), saved.name());
        assertEquals(SelectableSettings.DEFAULT, saved.settings());
        assertEquals(new SelectableChanged(TENANT, "o", "selectable.replaced", "sel_abc1234",
                Map.of("name", "Mi lista", "options", 3, "source", "STATIC")), events.get(0));
        SelectableRequest valid = request("x", SelectionMode.SINGLE, List.of());
        SelectableRequest duplicateValues = request("x", SelectionMode.SINGLE,
                List.of(option("d", "a"), option("d", "b")));
        SelectableRequest noMode = request("x", null, List.of());
        SelectableRequest noName = new SelectableRequest(Map.of("es", " "), null, SelectionMode.SINGLE, null, null,
                null, List.of());
        SelectableRequest badLanguage = new SelectableRequest(Map.of("spanish", "x"), null, SelectionMode.SINGLE,
                null, null, null, List.of());
        SelectableRequest badValue = request("x", SelectionMode.SINGLE, List.of(option("has space", "a")));
        SelectableRequest noLabel = request("x", SelectionMode.SINGLE, List.of(option("v", " ")));

        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "x", valid));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", duplicateValues));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", noMode));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", noName));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", badLanguage));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", badValue));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "abc", noLabel));
        assertThrows(NoSuchElementException.class, () -> service.get(TENANT, "missing_key"));
    }

    @Test
    void optionsMayOnlyNameTheListsGroupsAKnownColorAndAParentWhenTheListDependsOnAnother() {
        SelectableOption grouped = option("a", "A").withGroup("vehicle").withLook("red", "truck");
        List<SelectableGroup> groups = List.of(SelectableGroup.of("vehicle", "Vehículo", "Vehicle"));
        Selectable saved = service.replace(TENANT, "o", "incidents", new SelectableRequest(Map.of("es", "I"), null,
                SelectionMode.SINGLE, null, groups, null, List.of(grouped)));
        assertEquals("vehicle", saved.options().get(0).group());

        SelectableRequest unknownGroup = new SelectableRequest(Map.of("es", "I"), null, SelectionMode.SINGLE, null,
                List.of(), null, List.of(grouped));
        SelectableRequest unknownColor = request("I", SelectionMode.SINGLE,
                List.of(option("a", "A").withLook("orange", null)));
        SelectableRequest parentWithoutDependsOn = request("I", SelectionMode.SINGLE,
                List.of(option("a", "A").withParent("CL-RM")));

        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "x_1", unknownGroup));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "x_1", unknownColor));
        assertThrows(IllegalArgumentException.class,
                () -> service.replace(TENANT, "o", "x_1", parentWithoutDependsOn));
    }

    @Test
    void aListDependsOnlyOnAnotherExistingListWhichThenCannotBeDeleted() {
        SelectableSettings onReason = SelectableSettings.dependingOn("reason");
        SelectableRequest dependent = new SelectableRequest(Map.of("es", "Sub"), null, SelectionMode.SINGLE,
                onReason, null, null, List.of(option("s", "S").withParent("r_1")));
        service.replace(TENANT, "o", "sub_reason", dependent);
        SelectableRequest onMissing = new SelectableRequest(Map.of("es", "Sub"), null, SelectionMode.SINGLE,
                SelectableSettings.dependingOn("missing_list"), null, null, List.of());
        SelectableRequest onItself = new SelectableRequest(Map.of("es", "Sub"), null, SelectionMode.SINGLE,
                SelectableSettings.dependingOn("sub_reason"), null, null, List.of());

        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "other", onMissing));
        assertThrows(IllegalArgumentException.class, () -> service.replace(TENANT, "o", "sub_reason", onItself));
        assertThrows(IllegalArgumentException.class, () -> service.delete(TENANT, "o", "reason"));
        assertTrue(service.delete(TENANT, "o", "sub_reason"));
        assertTrue(service.delete(TENANT, "o", "reason"));
    }

    @Test
    void staticOptionsAreFilteredByAccentFreeSearchParentAndLimit() {
        service.replace(TENANT, "o", "commune", new SelectableRequest(Map.of("es", "Comuna"), null,
                SelectionMode.SINGLE, SelectableSettings.dependingOn("reason"), null, null, List.of(
                        option("valparaiso", "Valparaíso").withParent("r_1"),
                        option("vina", "Viña del Mar").withParent("r_1"),
                        option("santiago", "Santiago").withParent("r_2"))));

        assertEquals(List.of("valparaiso"), values(service.options(TENANT, "commune", "VALPARAISO", null, null)));
        assertEquals(List.of("vina"), values(service.options(TENANT, "commune", "vina", null, null)));
        assertEquals(List.of("santiago"), values(service.options(TENANT, "commune", null, List.of("r_2"), null)));
        assertEquals(List.of("valparaiso"), values(service.options(TENANT, "commune", "", List.of("r_1"), 1)));
        assertEquals(1, service.options(TENANT, "commune", " ", List.of(), 0).size(), "the limit is at least one");
    }

    @Test
    void aDynamicListTakesItsOptionsFromItsSourceAndMustNameOneThatExists() {
        SelectableOptionSource colors = new ListedSystemSource("test.colors", Map.of("es", "Colores"), Map.of()) {
            @Override
            protected List<SelectableOption> all(String tenantCode) {
                return List.of(option("red", "Rojo"), option("green", "Verde"), option("blue", "Azul"));
            }
        };
        SelectableService withSource = new SelectableService(new InMemorySelectableStore(), List.of(),
                List.of(colors), events::add);
        SelectableRequest fromColors = new SelectableRequest(Map.of("es", "Color"), null, SelectionMode.SINGLE,
                null, null, SelectableSource.system("test.colors"), List.of());
        SelectableRequest fromNowhere = new SelectableRequest(Map.of("es", "Color"), null, SelectionMode.SINGLE,
                null, null, SelectableSource.system("test.nothing"), List.of());
        SelectableRequest dynamicWithOptions = new SelectableRequest(Map.of("es", "Color"), null,
                SelectionMode.SINGLE, null, null, SelectableSource.system("test.colors"), List.of(option("x", "X")));

        withSource.replace(TENANT, "o", "color", fromColors);

        assertEquals(List.of("green"), values(withSource.options(TENANT, "color", "verde", null, null)));
        assertEquals(2, withSource.options(TENANT, "color", null, null, 2).size());
        assertEquals(List.of("test.colors"),
                withSource.sources(TENANT).stream().map(SelectableOptionSource.Descriptor::ref).toList());
        assertThrows(IllegalArgumentException.class, () -> withSource.replace(TENANT, "o", "c2", fromNowhere));
        assertThrows(IllegalArgumentException.class,
                () -> withSource.replace(TENANT, "o", "c3", dynamicWithOptions));
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
        service.replace(TENANT, "o", "only_a", request("A", SelectionMode.SINGLE, List.of()));

        assertEquals(List.of("reason", "tags"), service.list("tenant-b").stream().map(Selectable::key).toList());
    }

    @Test
    void aDeleteThatRacesABindingNeverLeavesTheBindingDangling() throws Exception {
        CountDownLatch validated = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        SelectableStore pausingBind = new InMemorySelectableStore() {
            @Override
            public void bindAll(String tenantCode, Map<String, String> fieldToSelectable) {
                validated.countDown();
                await(release);
                super.bindAll(tenantCode, fieldToSelectable);
            }
        };
        SelectableService racing = new SelectableService(pausingBind,
                List.of(tenant -> List.of(list(tenant, "tags", SelectionMode.MULTIPLE, "t_1"))), events::add);
        racing.list(TENANT);
        SelectableBindingsRequest bindToTags = new SelectableBindingsRequest(Map.of("who_to_call", "tags"));
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<?> binding = pool.submit(() -> racing.updateBindings(TENANT, "o", bindToTags));
            assertTrue(validated.await(5, TimeUnit.SECONDS), "binding passed validation");
            Thread deleting = new Thread(() -> racing.delete(TENANT, "o", "tags"));
            deleting.start();
            // Unguarded, the delete completes in the gap; guarded, it waits for the binding's lock.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (deleting.isAlive() && deleting.getState() != Thread.State.BLOCKED
                    && System.nanoTime() < deadline) {
                Thread.onSpinWait();
            }
            release.countDown();
            binding.get(5, TimeUnit.SECONDS);
            deleting.join(TimeUnit.SECONDS.toMillis(5));
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
        flakyService.replace(TENANT, "o", "custom", request("Mine", SelectionMode.SINGLE, List.of()));
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

    private static List<String> values(List<SelectableOption> options) {
        return options.stream().map(SelectableOption::value).toList();
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static SelectableOption option(String value, String label) {
        return new SelectableOption(value, Map.of("es", label), Map.of(), null, null, null, null, false);
    }

    private static SelectableRequest request(String name, SelectionMode mode, List<SelectableOption> options) {
        return new SelectableRequest(Map.of("es", name), null, mode, null, null, null, options);
    }

    private static Selectable list(String tenant, String key, SelectionMode mode, String... values) {
        List<SelectableOption> options = new ArrayList<>();
        for (String value : values) {
            options.add(option(value, value.toUpperCase()));
        }
        return Selectable.of(key, key, key, "", "", mode, options).forTenant(tenant);
    }
}
