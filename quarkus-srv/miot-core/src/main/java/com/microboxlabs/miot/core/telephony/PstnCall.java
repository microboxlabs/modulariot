package com.microboxlabs.miot.core.telephony;

import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;

/**
 * One PSTN call from the provider's call records: a Microsoft Graph {@code pstnCallLogRow} (Calling Plans,
 * Operator Connect) or {@code directRoutingLogRow} (Direct Routing).
 *
 * @param callId            {@code callId} of a PSTN row, {@code correlationId} of a Direct Routing row
 * @param userPrincipalName the Microsoft user who placed or received it, or null
 * @param callerNumber      E.164 when the record has it, else as recorded
 * @param calleeNumber      E.164 when the record has it, else as recorded
 * @param durationSeconds   connected seconds
 * @param answered          whether the call connected; null when the report does not say
 */
public record PstnCall(String id, String callId, String userPrincipalName, String callerNumber,
        String calleeNumber, Instant start, Instant end, int durationSeconds, String callType, Boolean answered,
        Report report) {

    /** The Graph report a record comes from. */
    public enum Report {
        PSTN, DIRECT_ROUTING
    }

    /** A {@link Report#PSTN} record whose result is its duration. */
    public PstnCall(String id, String callId, String userPrincipalName, String callerNumber, String calleeNumber,
            Instant start, Instant end, int durationSeconds, String callType) {
        this(id, callId, userPrincipalName, callerNumber, calleeNumber, start, end, durationSeconds, callType, null,
                Report.PSTN);
    }

    /**
     * Whether the call left Teams toward the PSTN. PSTN types carry an {@code out} part ({@code user_out},
     * {@code user_out_conf}, {@code user_out_forwarding}, {@code conf_out}, ...); inbound ones carry {@code in}.
     * Direct Routing types start with {@code ByotOut} ({@code ByotOut}, {@code ByotOutUserForwarding}, ...) or, in
     * the older names, carry an {@code out} part ({@code dr_out}, {@code dr_out_user_conf}, ...).
     */
    public boolean outbound() {
        if (callType == null) {
            return false;
        }
        String type = callType.toLowerCase(Locale.ROOT);
        if (report == Report.DIRECT_ROUTING && type.startsWith("byotout")) {
            return true;
        }
        return Arrays.asList(type.split("_")).contains("out");
    }

    /** Whether the call connected: what the report says, else a connected duration. */
    public boolean connected() {
        return answered != null ? answered : durationSeconds > 0;
    }
}
