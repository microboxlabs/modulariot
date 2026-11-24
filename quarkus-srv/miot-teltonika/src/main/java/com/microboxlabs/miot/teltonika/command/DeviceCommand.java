package com.microboxlabs.miot.teltonika.command;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A Codec 12 command for a device ({@code miot_teltonika.device_command}). Commands wait as
 * {@code pending}; the instance holding the device's session claims one ({@code sent}) before writing
 * it to the socket, so two instances never send the same command; the device's answer makes it
 * {@code answered}. A command not sent before {@code expiresAt} becomes {@code expired}.
 */
public record DeviceCommand(
        UUID id,
        String imei,
        String tenantCode,
        String command,
        String purpose,
        String status,
        String response,
        String requestedBy,
        OffsetDateTime requestedAt,
        OffsetDateTime sentAt,
        OffsetDateTime answeredAt,
        OffsetDateTime expiresAt) {

    public static final String PENDING = "pending";
    public static final String SENT = "sent";
    public static final String ANSWERED = "answered";
    public static final String FAILED = "failed";
    public static final String EXPIRED = "expired";

    /** Requested through the API. */
    public static final String MANUAL = "manual";
    /** {@code getparam 2015}: the device proves possession with the activation code. */
    public static final String ACTIVATION = "activation";
    /** {@code getparam} of a frequency parameter before intensive tracking changes it. */
    public static final String INTENSIVE_READ = "intensive_read";
    public static final String INTENSIVE_START = "intensive_start";
    /** Restores the frequency; retried until the device confirms it. */
    public static final String INTENSIVE_END = "intensive_end";
    /** A configuration profile sent to the device. */
    public static final String PROFILE = "profile";

    public boolean open() {
        return PENDING.equals(status) || SENT.equals(status);
    }
}
