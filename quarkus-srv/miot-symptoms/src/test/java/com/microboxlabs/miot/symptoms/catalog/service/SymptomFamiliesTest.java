package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectionMode;
import java.util.List;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;

class SymptomFamiliesTest {

    @Test
    void theOrganizationsListWins() {
        Selectable own = Selectable.of(SymptomFamilies.KEY, "Familias", "Families", "", "", SelectionMode.SINGLE,
                List.of(SelectableOption.of("mine", "Mía", "Mine")));
        SymptomFamilies families = new SymptomFamilies(tenant -> own);
        assertEquals(List.of("mine"), families.options("tenant-a").stream().map(SelectableOption::value).toList());
    }

    @Test
    void anOrganizationWithoutTheListGetsTheDefaults() {
        SymptomFamilies families = new SymptomFamilies(tenant -> {
            throw new NoSuchElementException("selectable not found");
        });
        List<SelectableOption> options = families.options("tenant-a");
        assertEquals(8, options.size());
        assertEquals("driving_safety", options.get(0).value());
        assertEquals("Seguridad de conducción", options.get(0).label().get("es"));
        assertEquals(SymptomFamilies.KEY, families.forTenant("tenant-a").get(0).key());
    }
}
