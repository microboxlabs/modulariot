package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import java.time.Instant;
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
    private final List<String> issued = new ArrayList<>();
    private final Telephony telephony = new Telephony() {
        @Override
        public List<TelephonyLine> lines(String tenantCode) {
            return List.copyOf(lines);
        }

        @Override
        public WebRtcToken webRtcToken(String tenantCode, String connectionId, String operator, String callee,
                String caseRef) {
            issued.add(connectionId + " " + operator);
            return new WebRtcToken("jwt", "+56900000000", Instant.EPOCH);
        }

        @Override
        public boolean whatsAppCalling(String tenantCode) {
            return whatsApp;
        }

        @Override
        public WebRtcToken whatsAppCall(String tenantCode, String connectionId, String operator, String callee,
                String caseRef) {
            issued.add("whatsapp " + connectionId + " " + callee);
            return new WebRtcToken("jwt", "+56900000000", Instant.EPOCH);
        }

        @Override
        public WebRtcToken answerWhatsAppCall(String tenantCode, String connectionId, String operator, String inboundId) {
            issued.add("answer " + connectionId + " " + inboundId);
            return new WebRtcToken("jwt", "+12025550100", Instant.EPOCH);
        }
    };
    private boolean whatsApp;
    private final TelephonyChoiceService service = new TelephonyChoiceService(new InMemoryTowerSettingsStore(),
            telephony, new AuditService(new InMemoryAuditStore()));

    private static final TelephonyLine MANAGED = new TelephonyLine("p1", TelephonyProvider.TELNYX, "Plataforma",
            "+56900000000", true, true);

    @Test
    void incomingWhatsAppUsesTheManagedLineWhenOutboundVoiceUsesTeams() {
        lines.addAll(List.of(MANAGED, TEAMS));
        whatsApp = true;
        service.save("acme", "operator", new TelephonyRequest("TEAMS_PHONE"));
        assertEquals(false, service.get("acme").whatsAppCalling());
        assertEquals(true, service.get("acme").whatsAppIncoming());
        service.answerWhatsAppCall("acme", "operator", "incoming-1");
        assertEquals(List.of("answer p1 incoming-1"), issued);
        lines.clear();
        lines.add(TELNYX);
        assertThrows(TelephonyUnavailableException.class,
                () -> service.answerWhatsAppCall("acme", "operator", "incoming-1"));
    }

    @Test
    void unsupportedChannelsCannotSilentlyPlacePstnCalls() {
        lines.add(MANAGED);
        for (String channel : List.of("WHATSAPP ", "VOICE", "", "SMS")) {
            var request = new TelephonyChoiceService.CallRequest("+12025550101", null, channel);
            assertThrows(IllegalArgumentException.class, () -> service.webRtcToken("acme", "operator", request));
        }
        assertEquals(List.of(), issued);
    }

    @Test
    void theWhatsAppButtonCallsOnlyOnTheManagedLineWhileWhatsAppCallingIsOn() {
        lines.add(MANAGED);
        assertEquals(false, service.get("acme").whatsAppCalling());
        whatsApp = true;
        assertEquals(true, service.get("acme").whatsAppCalling());
        service.webRtcToken("acme", "ana@example.com",
                new TelephonyChoiceService.CallRequest("+56911111111", "7", "WHATSAPP"));
        assertEquals(List.of("whatsapp p1 +56911111111"), issued);

        lines.clear();
        lines.add(TELNYX);
        assertEquals(false, service.get("acme").whatsAppCalling(), "an organization's own Telnyx line");
    }

    @Test
    void aTokenIsIssuedOnTheTelnyxLineOnly() {
        lines.addAll(List.of(TELNYX, TEAMS));
        assertEquals("jwt", service.webRtcToken("acme", "ana@example.com").token());
        assertEquals(List.of("t1 ana@example.com"), issued);

        service.save("acme", "owner@example.com", new TelephonyRequest("TEAMS_PHONE"));
        assertThrows(TelephonyUnavailableException.class, () -> service.webRtcToken("acme", "ana@example.com"));
    }

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
    @Test
    void aLineLookupFailureDoesNotPersistAChoiceAndASuccessfulSaveDoesNotReadTwice() {
        var store = new InMemoryTowerSettingsStore();
        var reads = new java.util.concurrent.atomic.AtomicInteger();
        var choice = new TelephonyChoiceService(store, tenant -> {
            if (reads.incrementAndGet() != 2) {
                throw new IllegalStateException("Synthetic line lookup failure");
            }
            return List.of(TEAMS);
        }, new AuditService(new InMemoryAuditStore()));
        var request = new TelephonyRequest("TEAMS_PHONE");
        assertThrows(IllegalStateException.class, () -> choice.save("acme", "owner", request));
        assertEquals(java.util.Optional.empty(), store.telephonyProvider("acme"));
        var saved = choice.save("acme", "owner", request);
        assertEquals(TEAMS, saved.active());
        assertEquals(TelephonyProvider.TEAMS_PHONE, saved.preferred());
        assertEquals(2, reads.get());
    }

    @Test
    void theInMemoryPreferencePreservesTeamValuesAndRecordsWhoChangedIt() {
        var store = new InMemoryTowerSettingsStore();
        store.saveTelephonyProvider("new", "TELNYX", "first-owner");
        var defaults = store.find("new").orElseThrow();
        assertEquals("first-owner", defaults.updatedBy());
        org.junit.jupiter.api.Assertions.assertNotNull(defaults.updatedAt());
        store.save(new com.microboxlabs.miot.symptoms.domain.TowerSettings("acme", 12, 6, 100, "old-owner", null));
        store.saveTelephonyProvider("acme", "TEAMS_PHONE", "new-owner");
        var saved = store.find("acme").orElseThrow();
        assertEquals(12, saved.operators());
        assertEquals(6, saved.shiftHours());
        assertEquals(100, saved.capacityPerShift());
        assertEquals("new-owner", saved.updatedBy());
        org.junit.jupiter.api.Assertions.assertNotNull(saved.updatedAt());
        store.saveTelephonyProvider("acme", null, "auto-owner");
        assertEquals(java.util.Optional.empty(), store.telephonyProvider("acme"));
        assertEquals("auto-owner", store.find("acme").orElseThrow().updatedBy());
    }

}
