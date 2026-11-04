package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.microboxlabs.miot.integrations.telephony.StubHttp;
import com.microboxlabs.miot.integrations.telephony.TelnyxClient;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TelnyxCredentialTesterTest {

    private static final Map<String, Object> TELNYX = Map.of("provider", "telnyx");

    private final StubHttp http = new StubHttp();
    private final TelnyxCredentialTester tester =
            new TelnyxCredentialTester(new TelnyxClient(http, URI.create("https://api.telnyx.test")));

    @Test
    void onlyClaimsBearerTokensTaggedTelnyx() {
        assertTrue(tester.supports(CredentialType.BEARER_TOKEN, TELNYX));
        assertFalse(tester.supports(CredentialType.BEARER_TOKEN, Map.of("provider", "mapbox")));
        assertFalse(tester.supports(CredentialType.BEARER_TOKEN, Map.of()));
        assertFalse(tester.supports(CredentialType.BEARER_TOKEN));
    }

    @Test
    void aKeyTelnyxAcceptsPasses() {
        http.reply("/v2/balance", 200, "{\"data\":{\"balance\":\"1.00\"}}");

        CredentialTestResponse response =
                tester.test(CredentialType.BEARER_TOKEN, TELNYX, Map.of("token", " KEY_test "));

        assertTrue(response.success(), response.message());
        assertEquals("Bearer KEY_test", http.last().header("Authorization"));
    }

    @Test
    void aRejectedKeyFails() {
        http.reply("/v2/balance", 401, "{\"errors\":[]}");

        CredentialTestResponse response =
                tester.test(CredentialType.BEARER_TOKEN, TELNYX, Map.of("token", "KEY_bad"));

        assertFalse(response.success());
        assertTrue(response.message().contains("rejected"), response.message());
    }

    @Test
    void aMissingKeyFailsWithoutCallingTelnyx() {
        CredentialTestResponse response = tester.test(CredentialType.BEARER_TOKEN, TELNYX, Map.of());

        assertFalse(response.success());
        assertTrue(http.seen().isEmpty());
    }
}
