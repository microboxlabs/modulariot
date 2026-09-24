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

    private static Selectable list(String tenant, String key, SelectionMode mode, String... ids) {
        List<SelectableOption> options = new ArrayList<>();
        for (String id : ids) {
            options.add(new SelectableOption(id, id.toUpperCase(), ""));
        }
        return new Selectable(tenant, key, key, "", mode, options, "system:defaults", null);
    }
}
