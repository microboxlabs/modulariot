package com.microboxlabs.miot.core.telephony;

import java.time.Instant;

/**
 * One PSTN call from the provider's call records (Microsoft Graph {@code pstnCallLogRow}).
 *
 * @param userPrincipalName the Microsoft user who placed or received it, or null
 * @param callerNumber      E.164 when the record has it, else as recorded
 * @param calleeNumber      E.164 when the record has it, else as recorded
 * @param durationSeconds   connected seconds
 */
public record PstnCall(String id, String callId, String userPrincipalName, String callerNumber,
        String calleeNumber, Instant start, Instant end, int durationSeconds, String callType) {
}
