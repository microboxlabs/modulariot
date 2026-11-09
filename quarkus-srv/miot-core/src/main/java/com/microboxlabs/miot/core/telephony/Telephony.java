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
        return webRtcToken(tenantCode, connectionId, operator, null, null);
    }

    /**
     * Like {@link #webRtcToken(String, String, String)}, recording the call in the usage ledger.
     *
     * @param calleeNumber E.164 destination requested by the browser; verified provider data determines billing
     * @param caseRef      the case the call is about; may be null
     */
    default WebRtcToken webRtcToken(String tenantCode, String connectionId, String operator, String calleeNumber,
            String caseRef) {
        throw new TelephonyUnavailableException("Telephony is not available in this build");
    }

    /** Whether the organization's calls can reach WhatsApp: WhatsApp calling is configured and its line is the managed one. */
    default boolean whatsAppCalling(String tenantCode) {
        return false;
    }

    /**
     * Like {@link #webRtcToken(String, String, String, String, String)} for a WhatsApp call: the server dials
     * {@code calleeNumber} on WhatsApp when the operator's leg is admitted, and bridges the two.
     *
     * @throws TelephonyUnavailableException {@code WHATSAPP_NO_PERMISSION} when the contact has not allowed calls,
     *         {@code WHATSAPP_UNAVAILABLE} when WhatsApp calling is off for the organization
     */
    default WebRtcToken whatsAppCall(String tenantCode, String connectionId, String operator, String calleeNumber,
            String caseRef) {
        throw new TelephonyUnavailableException(TelephonyUnavailableException.WHATSAPP_UNAVAILABLE,
                "WhatsApp calling is not available in this build");
    }

    /** The WhatsApp calls ringing in the organization's tower, oldest first. */
    default java.util.List<InboundCall> ringingWhatsAppCalls(String tenantCode) {
        return java.util.List.of();
    }

    /**
     * A login for the operator to take a ringing WhatsApp call: the operator's leg is bridged to it on admission.
     *
     * @throws TelephonyUnavailableException {@code WHATSAPP_CALL_TAKEN} when it is no longer ringing
     */
    default WebRtcToken answerWhatsAppCall(String tenantCode, String connectionId, String operator,
            String inboundCallId) {
        throw new TelephonyUnavailableException(TelephonyUnavailableException.WHATSAPP_UNAVAILABLE,
                "WhatsApp calling is not available in this build");
    }

    /** Why the provider ended the call before it connected (a {@link TelephonyUnavailableException} code), if known. */
    default java.util.Optional<String> callFailure(String tenantCode, String callRef) {
        return java.util.Optional.empty();
    }

    /**
     * The browser says a call ended. Frees its reservation; the untrusted providerCallId is ignored.
     * Provider identifiers and billing data must come from verified provider deliveries.
     */
    default void callEnded(String tenantCode, String callRef, String providerCallId) {
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
