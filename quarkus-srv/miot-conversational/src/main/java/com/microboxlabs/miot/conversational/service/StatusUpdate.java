package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.MessageStatus;
import java.time.OffsetDateTime;

/**
 * A delivery/read/failed status callback for a previously-sent outbound message, parsed out of a
 * Meta webhook envelope. Keyed by {@code wamid} — the same id we stored on send — so mirroring is
 * a lookup + advance-only update, no org routing needed.
 */
public record StatusUpdate(
        String wamid,
        MessageStatus status,
        String recipientE164,
        String error,
        OffsetDateTime timestamp) {
}
