package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService.SettingsRequest;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTowerSettingsStore;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TowerSettingsServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String OWNER = "owner@example.com";

    private AuditService audit;
    private TowerSettingsService service;

    @BeforeEach
    void setUp() {
        audit = new AuditService(new InMemoryAuditStore());
        service = new TowerSettingsService(new InMemoryTowerSettingsStore(), audit);
    }

    @Test
    void anOrganizationThatSavedNothingGetsEightHourShifts() {
        TowerSettings s = service.get(TENANT);
        assertEquals(8, s.shiftHours());
        assertNull(s.operators());
        assertNull(s.capacityPerShift());
        assertNull(s.updatedBy());
    }

    @Test
    void savedSettingsStayInTheirOrganizationAndAreAudited() {
        TowerSettings saved = service.save(TENANT, OWNER, new SettingsRequest(3, null, 150));
        assertEquals(8, saved.shiftHours(), "shift length defaults to 8");
        assertEquals(3, service.get(TENANT).operators());
        assertEquals(OWNER, service.get(TENANT).updatedBy());
        assertNull(service.get("tenant-b").operators());

        service.save(TENANT, OWNER, new SettingsRequest(null, 12, null));
        assertNull(service.get(TENANT).operators(), "null clears a value");
        assertEquals(12, service.get(TENANT).shiftHours());

        List<AuditEvent> events = audit.list(TENANT, "settings", null, null, null, null, 10);
        assertEquals(2, events.size());
        assertEquals("settings.saved", events.get(0).action());
    }

    @Test
    void valuesOutOfRangeAreRejected() {
        List<SettingsRequest> bad = List.of(new SettingsRequest(-1, 8, 10), new SettingsRequest(1, 0, 10),
                new SettingsRequest(1, 25, 10), new SettingsRequest(1, 8, -5),
                new SettingsRequest(TowerSettingsService.MAX_OPERATORS + 1, 8, 10),
                new SettingsRequest(1, 8, TowerSettingsService.MAX_CAPACITY + 1));
        for (SettingsRequest r : bad) {
            assertThrows(IllegalArgumentException.class, () -> service.save(TENANT, OWNER, r), r.toString());
        }
        assertThrows(IllegalArgumentException.class, () -> service.save(TENANT, OWNER, null));
        assertNull(service.get(TENANT).updatedBy(), "nothing was saved");
    }
}
