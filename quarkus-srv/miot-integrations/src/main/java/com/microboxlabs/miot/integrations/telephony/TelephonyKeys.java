package com.microboxlabs.miot.integrations.telephony;

/** Where TELNYX and TEAMS_PHONE connections keep their values. Secrets live only in the credential. */
public final class TelephonyKeys {

    /** TELNYX metadata: the id of the Telnyx credential connection (SIP) the browser registers on. */
    public static final String SIP_CONNECTION_ID = "sipConnectionId";
    /** TELNYX metadata: the number callees see, in E.164. */
    public static final String CALLER_NUMBER = "callerNumber";
    /** TEAMS_PHONE metadata, optional: the caller id the Teams client should present, in E.164. */
    public static final String DEFAULT_CALLER_ID = "defaultCallerId";
    /** TELNYX credential secret: the API key (a bearer token credential). */
    public static final String TOKEN = "token";

    private TelephonyKeys() {
    }
}
