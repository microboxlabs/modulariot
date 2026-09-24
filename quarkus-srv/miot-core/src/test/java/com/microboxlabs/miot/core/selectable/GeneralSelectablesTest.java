package com.microboxlabs.miot.core.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.api.dto.SelectableRequest;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class GeneralSelectablesTest {

    private static final String TENANT = "tenant-a";

    private final SelectableService service = new SelectableService(new InMemorySelectableStore(),
            List.of(new GeneralSelectables()),
            List.of(new CoreSystemSources.TimeZones(), new CoreSystemSources.Currencies()), e -> { });

    /** Defaults skip validation when seeded, so prove each one would pass it as a write. */
    @Test
    void everyDefaultListPassesTheSameRulesAsAWrite() {
        for (Selectable s : service.list(TENANT)) {
            Selectable saved = service.replace(TENANT, "o", s.key(), new SelectableRequest(s.name(),
                    s.description(), s.mode(), s.settings(), s.groups(), s.source(), s.options()));
            assertEquals(s.options(), saved.options(), s.key());
            assertEquals(Localized.of(s.name().get("es"), s.name().get("en")), saved.name(), s.key());
        }
    }

    @Test
    void keysAreUnique() {
        List<String> keys = new GeneralSelectables().forTenant(TENANT).stream().map(Selectable::key).toList();

        assertEquals(keys.size(), Set.copyOf(keys).size(), keys.toString());
    }

    @Test
    void aMisspelledFieldFailsTheRead() {
        UncheckedIOException e = assertThrows(UncheckedIOException.class,
                () -> SelectableDefaultsFile.read(getClass(), "/selectables/typo.json"));

        assertTrue(e.getCause().getMessage().contains("colour"), e.getCause().getMessage());
    }

    @Test
    void omittedFieldsTakeTheirDefaults() {
        Selectable yesNo = service.get(TENANT, "yes_no");

        assertEquals(SelectableSettings.DEFAULT, yesNo.settings());
        assertEquals(SelectableSource.STATIC, yesNo.source());
        assertEquals(List.of(), yesNo.groups());
        assertEquals(Map.of(), yesNo.options().get(0).description());
    }

    @Test
    void everyListIsInSpanishAndEnglish() {
        for (Selectable s : new GeneralSelectables().forTenant(TENANT)) {
            assertEquals(List.of("es", "en"), List.copyOf(s.name().keySet()), s.key());
            s.options().forEach(o -> assertTrue(o.label().keySet().containsAll(List.of("es", "en")),
                    s.key() + "." + o.value()));
        }
    }

    @Test
    void communesFollowTheRegionPicked() {
        List<String> santiago = service.options(TENANT, "commune", null, List.of("CL-RM"), null).stream()
                .map(SelectableOption::value).toList();

        assertTrue(santiago.containsAll(List.of("santiago", "providencia", "puente_alto")));
        assertFalse(santiago.contains("valparaiso"));
    }

    @Test
    void systemListsAreFetchedAndSearchable() {
        assertEquals(List.of("America/Santiago"), service.options(TENANT, "timezone", "santiago", null, null)
                .stream().map(SelectableOption::value).toList());
        List<SelectableOption> peso = service.options(TENANT, "currency", "CLP", null, null);
        assertEquals("CLP", peso.get(0).value());
        assertTrue(peso.get(0).label().get("es").startsWith("CLP — "));
        assertEquals(SelectableService.DEFAULT_OPTION_LIMIT, service.options(TENANT, "timezone", null, null, null)
                .size());
        assertTrue(service.get(TENANT, "timezone").options().isEmpty(), "a system list stores no options");
    }
}
