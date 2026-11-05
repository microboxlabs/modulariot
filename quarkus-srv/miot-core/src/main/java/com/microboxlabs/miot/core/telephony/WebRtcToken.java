package com.microboxlabs.miot.core.telephony;

import java.time.Instant;

/**
 * A reusable provider login for the operator's browser phone. The call reference tracks a reservation;
 * it does not constrain how many calls the provider accepts with this login.
 *
 * @param token        the provider's JWT; give it only to the operator it was issued for
 * @param callerNumber the number callees see, in E.164
 * @param expiresAt    when the provider stops accepting it
 * @param callRef      the usage row of this call; the browser sends it as the call's client state
 */
public record WebRtcToken(String token, String callerNumber, Instant expiresAt, String callRef) {

    public WebRtcToken(String token, String callerNumber, Instant expiresAt) {
        this(token, callerNumber, expiresAt, null);
    }

    @Override
    public String toString() {
        return "WebRtcToken[token=<redacted>, callerNumber=" + callerNumber + ", expiresAt=" + expiresAt
                + ", callRef=" + callRef + "]";
    }
}
