package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import java.util.List;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;

class SymptomFamiliesTest {

    @Test
    void theOrganizationsOptionsWin() {
        SymptomFamilies families = new SymptomFamilies(tenant -> List.of(SelectableOption.of("mine", "Mía", "Mine")));
        assertEquals(List.of("mine"), families.options("tenant-a").stream().map(SelectableOption::value).toList());
    }

    @Test
    void anOrganizationWithoutTheListIsNotFound() {
        SymptomFamilies families = new SymptomFamilies(tenant -> {
            throw new NoSuchElementException("selectable not found");
        });
        assertThrows(NoSuchElementException.class, () -> families.options("tenant-a"));
    }

    @Test
    void anEmptyListHasNoFamilies() {
        assertEquals(List.of(), new SymptomFamilies(tenant -> List.of()).options("tenant-a"));
    }

    @Test
    void aNewOrganizationIsSeededWithTheDefaultFamilies() {
        SymptomFamilies families = new SymptomFamilies(tenant -> List.of());
        Selectable seeded = families.forTenant("tenant-a").get(0);
        assertEquals(SymptomFamilies.KEY, seeded.key());
        assertEquals(8, seeded.options().size());
        assertEquals("driving_safety", seeded.options().get(0).value());
        assertEquals("Seguridad de conducción", seeded.options().get(0).label().get("es"));
    }
}
