package com.microboxlabs.miot.core.telephony;

/** The telephony providers an organization can connect for the Control Tower's calls. */
public enum TelephonyProvider {
    /** Calls placed from the browser through Telnyx WebRTC. */
    TELNYX,
    /** Calls placed from the operator's Microsoft Teams client, with Teams Phone. */
    TEAMS_PHONE
}
