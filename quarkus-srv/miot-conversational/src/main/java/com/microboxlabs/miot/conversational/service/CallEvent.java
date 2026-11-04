package com.microboxlabs.miot.conversational.service;

import java.time.OffsetDateTime;

/**
 * A {@code calls} webhook event. {@code contactE164} is the other party: {@code to} on a business-initiated
 * call, {@code from} on a user-initiated one. Meta sends an unanswered call's {@code terminate} as COMPLETED
 * without {@code start_time}, {@code end_time} or {@code duration}.
 *
 * @param event     {@code connect} or {@code terminate}
 * @param direction {@code BUSINESS_INITIATED} or {@code USER_INITIATED}
 * @param status    {@code COMPLETED} or {@code FAILED} on a terminate; null otherwise
 * @param connected the call was picked up: it has a start time or a duration
 */
public record CallEvent(
        String phoneNumberId,
        String callId,
        String contactE164,
        String event,
        String direction,
        String status,
        boolean connected,
        OffsetDateTime timestamp) {

    public static final String TERMINATE = "terminate";
    public static final String BUSINESS_INITIATED = "BUSINESS_INITIATED";

    public boolean terminated() {
        return TERMINATE.equalsIgnoreCase(event);
    }

    public boolean businessInitiated() {
        return BUSINESS_INITIATED.equalsIgnoreCase(direction);
    }
}
