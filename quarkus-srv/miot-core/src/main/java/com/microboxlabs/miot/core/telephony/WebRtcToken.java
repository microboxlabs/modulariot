package com.microboxlabs.miot.core.telephony;

import java.time.Instant;

/**
 * A short-lived login for the operator's browser phone.
 *
 * @param token        the provider's JWT; give it only to the operator it was issued for
 * @param callerNumber the number callees see, in E.164
 * @param expiresAt    when the provider stops accepting it
 */
public record WebRtcToken(String token, String callerNumber, Instant expiresAt) {

    @Override
    public String toString() {
        return "WebRtcToken[token=<redacted>, callerNumber=" + callerNumber + ", expiresAt=" + expiresAt + "]";
    }
}
