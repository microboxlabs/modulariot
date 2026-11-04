package com.microboxlabs.miot.integrations.telephony;

/** A reservation consumed by one parked WebRTC leg. The target state is never given to the browser. */
public record CallAdmission(String callRef, String parkedCallId, String targetState) {
}
