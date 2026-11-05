package com.microboxlabs.miot.core.telephony;

/**
 * One telephony connection an organization's calls can use, without its secrets.
 *
 * @param callerNumber the number callees see, in E.164, or null when the provider decides
 * @param ready        whether the connection's last test passed
 * @param managed      the platform's line, shared by organizations without their own and charged per minute
 */
public record TelephonyLine(String connectionId, TelephonyProvider provider, String name, String callerNumber,
        boolean ready, boolean managed) {

    /** The organization's own line. */
    public TelephonyLine(String connectionId, TelephonyProvider provider, String name, String callerNumber,
            boolean ready) {
        this(connectionId, provider, name, callerNumber, ready, false);
    }
}
