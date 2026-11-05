package com.microboxlabs.miot.core.telephony;

import java.util.List;

/**
 * The organization's telephony connections. Implemented by the integrations module; without it
 * an organization has no lines and calls fall back to the phone's own dialer.
 */
public interface Telephony {

    /** The organization's telephony connections, at most one per provider. */
    List<TelephonyLine> lines(String tenantCode);

    /**
     * A WebRTC login for {@code operator} on the organization's TELNYX connection.
     *
     * @throws TelephonyUnavailableException when the connection is not a usable TELNYX one, or Telnyx refuses
     */
    default WebRtcToken webRtcToken(String tenantCode, String connectionId, String operator) {
        return webRtcToken(tenantCode, connectionId, operator, null, null);
    }

    /**
     * Like {@link #webRtcToken(String, String, String)}, recording the call in the usage ledger.
     *
     * @param calleeNumber E.164 destination requested by the browser; verified provider data determines billing
     * @param caseRef      the case the call is about; may be null
     */
    default WebRtcToken webRtcToken(String tenantCode, String connectionId, String operator, String calleeNumber,
            String caseRef) {
        throw new TelephonyUnavailableException("Telephony is not available in this build");
    }

    /**
     * The browser says a call ended. Frees its reservation; the untrusted providerCallId is ignored.
     * Provider identifiers and billing data must come from verified provider deliveries.
     */
    default void callEnded(String tenantCode, String callRef, String providerCallId) {
    }

    /**
     * The PSTN calls the TEAMS_PHONE connection's call records hold between {@code from} and {@code to}.
     * Records arrive late: an empty list means "not yet", not "no call".
     *
     * @throws TelephonyUnavailableException when the connection is not a usable TEAMS_PHONE one, or Graph refuses
     */
    default java.util.List<PstnCall> pstnCalls(String tenantCode, String connectionId, java.time.Instant from,
            java.time.Instant to) {
        throw new TelephonyUnavailableException("Telephony is not available in this build");
    }
}
