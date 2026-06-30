package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.MessageType;
import java.time.OffsetDateTime;

/**
 * A driver-originated message parsed out of a Meta webhook envelope. {@code fromE164} is already
 * normalized to {@code +}-prefixed E.164 so an inbound reply lands on the same conversation as the
 * outbound that anchored it (Meta sends {@code from} as bare digits, e.g. {@code 56912345678}).
 * For media types only the Meta media id ({@code mediaRef}) + mime/filename are captured here;
 * the binary download is Phase 2b.
 */
public record InboundMessage(
        String phoneNumberId,
        String fromE164,
        String contactName,
        String wamid,
        MessageType type,
        String body,
        String mediaRef,
        String mediaMimeType,
        String mediaFileName,
        OffsetDateTime timestamp) {
}
