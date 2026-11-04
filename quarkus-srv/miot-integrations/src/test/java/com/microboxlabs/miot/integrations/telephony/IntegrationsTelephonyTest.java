package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntegrationsTelephonyTest {

    @Test
    void listsOneLinePerConnectedProvider() {
        Map<ProviderType, IntegrationConnection> stored = Map.of(
                ProviderType.TELNYX, connection("t1", ProviderType.TELNYX, ConnectionStatus.ACTIVE,
                        Map.of("callerNumber", "+56 9 0000 0000")),
                ProviderType.TEAMS_PHONE, connection("m1", ProviderType.TEAMS_PHONE, ConnectionStatus.TEST_FAILED,
                        Map.of()));
        List<TelephonyLine> lines = new IntegrationsTelephony(
                (tenant, provider) -> "acme".equals(tenant) ? stored.get(provider) : null, null, null).lines("acme");

        assertEquals(2, lines.size());
        assertEquals(new TelephonyLine("t1", TelephonyProvider.TELNYX, "Line t1", "+56900000000", true), lines.get(0));
        assertEquals(TelephonyProvider.TEAMS_PHONE, lines.get(1).provider());
        assertFalse(lines.get(1).ready());
        assertNull(lines.get(1).callerNumber());
        assertTrue(new IntegrationsTelephony((tenant, provider) -> "acme".equals(tenant) ? stored.get(provider) : null, null, null)
                .lines("other-tenant").isEmpty());
    }

    @Test
    void noConnectionsNoLines() {
        assertTrue(new IntegrationsTelephony((tenant, provider) -> null, null, null).lines("acme").isEmpty());
    }

    @Test
    void e164AcceptsSeparatorsOnly() {
        assertEquals("+56900000000", PhoneNumbers.e164("+56 (9) 0000-0000"));
        assertEquals("+6834001", PhoneNumbers.e164("+683 4001"));
        assertNull(PhoneNumbers.e164("+683400"));
        assertEquals("+123456789012345", PhoneNumbers.e164("+123456789012345"));
        assertNull(PhoneNumbers.e164("+1234567890123456"));
        assertNull(PhoneNumbers.e164("56900000000"));
        assertNull(PhoneNumbers.e164("+0123456789"));
        assertNull(PhoneNumbers.e164(null));
    }

    private static IntegrationConnection connection(String id, ProviderType type, ConnectionStatus status,
            Map<String, Object> metadata) {
        return new IntegrationConnection(id, "acme", "Line " + id, type, null, "cred", status, null, null, metadata);
    }
}
