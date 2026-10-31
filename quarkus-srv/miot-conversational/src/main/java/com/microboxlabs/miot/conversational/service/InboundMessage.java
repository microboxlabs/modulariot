package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.MessageType;
import java.time.OffsetDateTime;

/**
 * A driver-originated message parsed out of a Meta webhook envelope. {@code fromE164} is already
 * normalized to {@code +}-prefixed E.164 so an inbound reply lands on the same conversation as the
 * outbound that anchored it (Meta sends {@code from} as bare digits, e.g. {@code 56900000000}).
 * For media types only the Meta media id ({@code mediaRef}) + mime/filename are captured here;
 * the binary download is Phase 2b.
 *
 * <p>{@code contextMessageId} is the wamid of the message being answered ({@code context.id}),
 * present on replies and button taps. {@code buttonPayload} is the payload of a quick-reply
 * button ({@code button.payload}) or the id of an interactive reply.
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
        OffsetDateTime timestamp,
        String contextMessageId,
        String buttonPayload) {

    public InboundMessage(
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
        this(phoneNumberId, fromE164, contactName, wamid, type, body, mediaRef, mediaMimeType,
                mediaFileName, timestamp, null, null);
    }
}
