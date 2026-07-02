package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import org.junit.jupiter.api.Test;

/**
 * Attribution rule for the M2M send path: the upstream {@code actor} wins; the M2M client
 * principal is only the fallback.
 */
class OrgWhatsAppOutboundResourceTest {

    private static final String PRINCIPAL = "ecm-coordinator@clients";

    @Test
    void actorFromRequestIsPreferredOverPrincipal() {
        assertEquals(
                "ops@mintral.cl",
                OrgWhatsAppOutboundResource.resolveActor(request("ops@mintral.cl"), PRINCIPAL));
    }

    @Test
    void fallsBackToPrincipalWhenActorMissingOrBlank() {
        assertEquals(PRINCIPAL, OrgWhatsAppOutboundResource.resolveActor(request(null), PRINCIPAL));
        assertEquals(PRINCIPAL, OrgWhatsAppOutboundResource.resolveActor(request("   "), PRINCIPAL));
    }

    @Test
    void returnsNullWhenNeitherActorNorPrincipalPresent() {
        assertNull(OrgWhatsAppOutboundResource.resolveActor(request(null), null));
        assertNull(OrgWhatsAppOutboundResource.resolveActor(null, null));
    }

    private static SendWhatsAppMessageRequest request(String actor) {
        return new SendWhatsAppMessageRequest(
                "+56900000000", "TEMPLATE", null, "pod_rejected_v1", "es_CL", null,
                MessageRole.AGENT, null, "SVC-1", null, "task-1", actor);
    }
}
