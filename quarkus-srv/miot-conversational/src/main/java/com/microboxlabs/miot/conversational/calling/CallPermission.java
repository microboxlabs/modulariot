package com.microboxlabs.miot.conversational.calling;

import java.time.Instant;

/**
 * The call permission one contact gave one business number (its Meta {@code phone_number_id}).
 *
 * @param consecutiveUnanswered business-initiated calls in a row the contact did not pick up
 * @param lastConnectedCallAt   the last call that connected; Meta resets the request limits then
 */
public record CallPermission(
        String businessPhoneNumberId,
        String contactE164,
        CallPermissionStatus status,
        Instant expiresAt,
        Instant respondedAt,
        String responseSource,
        int consecutiveUnanswered,
        Instant lastConnectedCallAt) {

    public static CallPermission none(String businessPhoneNumberId, String contactE164) {
        return new CallPermission(businessPhoneNumberId, contactE164, CallPermissionStatus.NONE, null, null, null,
                0, null);
    }

    /** Granted and not expired. */
    public boolean active(Instant now) {
        return status == CallPermissionStatus.PERMANENT
                || (status == CallPermissionStatus.TEMPORARY && expiresAt != null && expiresAt.isAfter(now));
    }
}
