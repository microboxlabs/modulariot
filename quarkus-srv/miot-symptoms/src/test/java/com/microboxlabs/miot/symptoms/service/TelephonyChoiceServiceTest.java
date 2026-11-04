package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.symptoms.service.TelephonyChoiceService.TelephonyRequest;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTowerSettingsStore;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class TelephonyChoiceServiceTest {

    private static final TelephonyLine TELNYX = new TelephonyLine("t1", TelephonyProvider.TELNYX, "Telnyx",
            "+56900000000", true);
    private static final TelephonyLine TEAMS = new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", null,
            true);

    private final List<TelephonyLine> lines = new ArrayList<>();
    private final TelephonyChoiceService service = new TelephonyChoiceService(new InMemoryTowerSettingsStore(),
            tenant -> List.copyOf(lines), new AuditService(new InMemoryAuditStore()));

    @Test
    void telnyxIsTheDefaultWhenBothAreConnected() {
        lines.addAll(List.of(TELNYX, TEAMS));
        assertEquals(TELNYX, service.get("acme").active());
        assertNull(service.get("acme").preferred());
    }

    @Test
    void teamsIsUsedWhenChosen() {
        lines.addAll(List.of(TELNYX, TEAMS));
        service.save("acme", "owner@example.com", new TelephonyRequest("teams_phone"));
        assertEquals(TEAMS, service.get("acme").active());
        assertEquals(TelephonyProvider.TEAMS_PHONE, service.get("acme").preferred());
    }

    @Test
    void theChoiceFallsBackWhenItsLineIsNotReady() {
        lines.addAll(List.of(TELNYX, new TelephonyLine("m1", TelephonyProvider.TEAMS_PHONE, "Teams", null, false)));
        service.save("acme", "owner@example.com", new TelephonyRequest("TEAMS_PHONE"));
        assertEquals(TELNYX, service.get("acme").active());

        lines.clear();
        lines.add(TEAMS);
        service.save("acme", "owner@example.com", new TelephonyRequest(null));
        assertEquals(TEAMS, service.get("acme").active(), "the only ready line is used");
    }

    @Test
    void noLinesNoActiveLine() {
        assertNull(service.get("acme").active());
        assertEquals(List.of(), service.get("acme").lines());
    }

    @Test
    void anUnknownProviderIsRefused() {
        var request = new TelephonyRequest("SKYPE");
        assertThrows(IllegalArgumentException.class,
                () -> service.save("acme", "owner@example.com", request));
    }
}
