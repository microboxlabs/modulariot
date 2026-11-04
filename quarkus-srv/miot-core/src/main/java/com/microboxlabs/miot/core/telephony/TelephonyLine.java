package com.microboxlabs.miot.core.telephony;

/**
 * One telephony connection of an organization, without its secrets.
 *
 * @param callerNumber the number callees see, in E.164, or null when the provider decides
 * @param ready        whether the connection's last test passed
 */
public record TelephonyLine(String connectionId, TelephonyProvider provider, String name, String callerNumber,
        boolean ready) {
}
