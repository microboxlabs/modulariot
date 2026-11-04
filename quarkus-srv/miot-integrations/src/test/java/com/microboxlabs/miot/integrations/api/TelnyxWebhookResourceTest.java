package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.telephony.InMemoryTelephonyUsageStore;
import com.microboxlabs.miot.integrations.telephony.InboundRouter;
import com.microboxlabs.miot.integrations.telephony.TelnyxCallEvents;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TelnyxWebhookResourceTest {

    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");
    private static final String BODY = "{\"data\":{\"event_type\":\"call.hangup\",\"payload\":{}}}";

    @Test
    void onlyASignedDeliveryForAKnownConnectionIsRead() throws Exception {
        KeyPair pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        byte[] der = pair.getPublic().getEncoded();
        String key = Base64.getEncoder().encodeToString(Arrays.copyOfRange(der, der.length - 32, der.length));
        IntegrationConnection connection = new IntegrationConnection("p1", "_platform", "Telnyx", ProviderType.TELNYX,
                null, "cred", ConnectionStatus.ACTIVE, null, null, Map.of("webhookPublicKey", key));
        InMemoryTelephonyUsageStore usage = new InMemoryTelephonyUsageStore();
        TelnyxWebhookResource resource = new TelnyxWebhookResource(id -> "p1".equals(id) ? connection : null,
                new TelnyxCallEvents(usage, new InboundRouter(usage), new ObjectMapper()),
                Clock.fixed(NOW, ZoneOffset.UTC));
        String ts = String.valueOf(NOW.getEpochSecond());
        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(pair.getPrivate());
        signer.update((ts + "|" + BODY).getBytes(StandardCharsets.UTF_8));
        String sig = Base64.getEncoder().encodeToString(signer.sign());

        assertEquals(403, resource.receive("unknown", sig, ts, BODY).getStatus());
        assertEquals(401, resource.receive("p1", sig, ts, BODY.replace("hangup", "answered")).getStatus());
        assertEquals(401, resource.receive("p1", null, ts, BODY).getStatus());
        assertEquals(200, resource.receive("p1", sig, ts, BODY).getStatus());
    }
}
