package com.microboxlabs.miot.conversational.service;

import java.time.OffsetDateTime;

/**
 * A contact's answer to a call permission request ({@code interactive.call_permission_reply}).
 *
 * @param accepted       {@code response} is {@code accept}
 * @param permanent      {@code is_permanent}; a temporary permission has {@code expiresAt}
 * @param expiresAt      {@code expiration_timestamp}; null for a permanent permission or a rejection
 * @param responseSource {@code user_action}, or {@code automatic} when the contact called the business
 */
public record CallPermissionReply(
        String phoneNumberId,
        String contactE164,
        String wamid,
        String contextMessageId,
        boolean accepted,
        boolean permanent,
        OffsetDateTime expiresAt,
        String responseSource,
        OffsetDateTime timestamp) {
}
