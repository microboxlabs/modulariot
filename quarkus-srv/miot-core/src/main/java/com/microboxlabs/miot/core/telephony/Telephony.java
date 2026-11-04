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
}
