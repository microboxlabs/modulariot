package com.microboxlabs.miot.teltonika.device;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A device registered by an organization ({@code miot_teltonika.device}).
 *
 * @param imei           IMEI (15 digits, Luhn) for Teltonika; for brands through Traccar, the identifier the
 *                       device sends (often the IMEI)
 * @param tenantCode     the organization's GPS client id; every record is published with it
 * @param model          device model, selects the connection guide
 * @param label          free text for the organization (e.g. installer, location)
 * @param active         false once deactivated: connections are refused
 * @param activationCode code the installer loads into the device (parameter 2015) to prove possession
 * @param activatedAt    when the device proved possession; null while the claim is pending
 * @param claimExpiresAt a pending claim not proved by then can be taken by another organization
 * @param captureUntil   while in the future, every packet of the device is kept in the packet log
 * @param configProfileId configuration profile (frequency, ignition, sleep, I/O); null: the standard one
 * @param inputProfileId  what is wired to each input and which events it produces; null: none
 */
public record Device(
        String imei,
        String tenantCode,
        String model,
        String label,
        boolean active,
        String activationCode,
        OffsetDateTime activatedAt,
        OffsetDateTime claimExpiresAt,
        OffsetDateTime captureUntil,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy,
        UUID configProfileId,
        UUID inputProfileId) {

    /** Without profiles. */
    public Device(String imei, String tenantCode, String model, String label, boolean active, String activationCode,
            OffsetDateTime activatedAt, OffsetDateTime claimExpiresAt, OffsetDateTime captureUntil,
            OffsetDateTime createdAt, String createdBy, OffsetDateTime updatedAt, String updatedBy) {
        this(imei, tenantCode, model, label, active, activationCode, activatedAt, claimExpiresAt, captureUntil,
                createdAt, createdBy, updatedAt, updatedBy, null, null);
    }

    /** Registered, possession not proved yet. */
    public boolean pending() {
        return active && activatedAt == null;
    }

    public boolean claimExpired(Instant now) {
        return pending() && claimExpiresAt != null && !claimExpiresAt.toInstant().isAfter(now);
    }

    /** Copy with other mutable fields. */
    public Device with(String model, String label, boolean active, OffsetDateTime activatedAt,
            OffsetDateTime captureUntil, OffsetDateTime updatedAt, String updatedBy) {
        return new Device(imei, tenantCode, model, label, active, activationCode, activatedAt, claimExpiresAt,
                captureUntil, createdAt, createdBy, updatedAt, updatedBy, configProfileId, inputProfileId);
    }

    /** Copy with other profiles. */
    public Device withProfiles(UUID configProfile, UUID inputProfile, OffsetDateTime updatedAt, String updatedBy) {
        return new Device(imei, tenantCode, model, label, active, activationCode, activatedAt, claimExpiresAt,
                captureUntil, createdAt, createdBy, updatedAt, updatedBy, configProfile, inputProfile);
    }

    /**
     * The identifier as stored: an IMEI for Teltonika, or what the device sends through Traccar
     * (letters and digits, 4 to 32). For lookups; registration validates by model.
     */
    public static String requireId(String id) {
        String s = id == null ? "" : id.trim();
        if (!s.matches("^[0-9A-Za-z]{4,32}$")) {
            throw new IllegalArgumentException("device id must be 4 to 32 letters and digits");
        }
        return s;
    }

    /** 15 digits with a valid Luhn check digit, as every IMEI has. */
    public static String requireImei(String imei) {
        String s = imei == null ? "" : imei.trim();
        if (!s.matches("^[0-9]{15}$") || !luhn(s)) {
            throw new IllegalArgumentException("imei must be the 15 digits printed on the device");
        }
        return s;
    }

    static boolean luhn(String digits) {
        int sum = 0;
        for (int i = 0; i < digits.length(); i++) {
            int d = digits.charAt(digits.length() - 1 - i) - '0';
            if (i % 2 == 1) {
                d *= 2;
                if (d > 9) {
                    d -= 9;
                }
            }
            sum += d;
        }
        return sum % 10 == 0;
    }
}
