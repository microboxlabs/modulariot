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
        throw new TelephonyUnavailableException("Telephony is not available in this build");
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
