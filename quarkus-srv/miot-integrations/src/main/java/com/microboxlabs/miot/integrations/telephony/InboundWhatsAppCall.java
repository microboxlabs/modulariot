package com.microboxlabs.miot.integrations.telephony;

import java.time.Instant;

/**
 * A WhatsApp call a contact placed to the business number ({@code miot_integrations.whatsapp_inbound_calls}).
 * {@code tenantCode} is null when no organization knows the caller. {@code callRef} is the ledger row of the
 * operator who took it.
 */
public record InboundWhatsAppCall(String id, String connectionId, String callControlId, String tenantCode,
        String callerNumber, String callerName, String caseRef, String status, String callRef, Instant createdAt,
        Instant updatedAt) {

    /** Parked: the caller hears it ring while the tower's operators are offered it. */
    public static final String RINGING = "RINGING";
    /** An operator asked to take it; their leg is being admitted. */
    public static final String CLAIMED = "CLAIMED";
    /** Bridged to an operator. */
    public static final String ANSWERED = "ANSWERED";
    /** Nobody answered in time, or no organization knows the caller: a message is played, then it hangs up. */
    public static final String MISSED = "MISSED";
    public static final String ENDED = "ENDED";

    InboundWhatsAppCall with(String newStatus, String newCallRef, Instant at) {
        return new InboundWhatsAppCall(id, connectionId, callControlId, tenantCode, callerNumber, callerName, caseRef,
                newStatus, newCallRef, createdAt, at);
    }
}
