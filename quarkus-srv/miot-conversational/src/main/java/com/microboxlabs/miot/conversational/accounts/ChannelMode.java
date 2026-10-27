package com.microboxlabs.miot.conversational.accounts;

/** Which account an organization's rules send a channel from. */
public enum ChannelMode {
    /** The platform's account, included for every organization. */
    PLATFORM,
    /** The organization's own connection. */
    OWN
}
