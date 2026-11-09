package com.microboxlabs.miot.core.telephony;

import java.time.Instant;

/** A WhatsApp call from a contact, ringing in the tower until an operator answers it. */
public record InboundCall(String id, String callerNumber, String callerName, String caseRef, Instant since) {
}
