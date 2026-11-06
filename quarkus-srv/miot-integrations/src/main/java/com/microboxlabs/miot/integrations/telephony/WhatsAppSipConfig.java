package com.microboxlabs.miot.integrations.telephony;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * WhatsApp voice calls over SIP between Meta and a Telnyx Call Control application. All values are server
 * configuration; WhatsApp calling is off while any of them is missing. See {@code miot-symptoms/docs/telephony.md}.
 */
@ApplicationScoped
public class WhatsAppSipConfig {

    static final String PREFIX = "miot.integrations.whatsapp-calling.";

    private final String connectionId;
    private final String sipHost;
    private final String businessNumber;
    private final String sipUsername;
    private final String sipPassword;
    private final String mediaEncryption;
    private final Duration ringTimeout;
    private final String unansweredMessage;

    @Inject
    public WhatsAppSipConfig(
            @ConfigProperty(name = PREFIX + "connection-id") Optional<String> connectionId,
            @ConfigProperty(name = PREFIX + "sip-host") Optional<String> sipHost,
            @ConfigProperty(name = PREFIX + "business-number") Optional<String> businessNumber,
            @ConfigProperty(name = PREFIX + "sip-username") Optional<String> sipUsername,
            @ConfigProperty(name = PREFIX + "sip-password") Optional<String> sipPassword,
            @ConfigProperty(name = PREFIX + "media-encryption") Optional<String> mediaEncryption,
            @ConfigProperty(name = PREFIX + "ring-timeout", defaultValue = "45s") Duration ringTimeout,
            @ConfigProperty(name = PREFIX + "unanswered-message",
                    defaultValue = "Hola. En este momento no hay operadores disponibles. Por favor, vuelva a llamar"
                            + " en unos minutos.") String unansweredMessage) {
        this(connectionId.orElse(null), sipHost.orElse(null), businessNumber.orElse(null), sipUsername.orElse(null),
                sipPassword.orElse(null), mediaEncryption.orElse(null), ringTimeout, unansweredMessage);
    }

    public WhatsAppSipConfig(String connectionId, String sipHost, String businessNumber, String sipUsername,
            String sipPassword, String mediaEncryption, Duration ringTimeout, String unansweredMessage) {
        this.connectionId = blankToNull(connectionId);
        this.sipHost = blankToNull(sipHost);
        this.businessNumber = PhoneNumbers.e164(blankToNull(businessNumber));
        this.sipUsername = blankToNull(sipUsername);
        this.sipPassword = blankToNull(sipPassword);
        String encryption = blankToNull(mediaEncryption);
        this.mediaEncryption = encryption == null ? null : encryption.toUpperCase(Locale.ROOT);
        this.ringTimeout = ringTimeout == null ? Duration.ofSeconds(45) : ringTimeout;
        this.unansweredMessage = unansweredMessage;
    }

    /** All values are set, and the media encryption is one Telnyx accepts for WhatsApp. */
    public boolean enabled() {
        return connectionId != null && sipHost != null && businessNumber != null && sipUsername != null
                && sipPassword != null && ("DTLS".equals(mediaEncryption) || "SRTP".equals(mediaEncryption));
    }

    /** Whether a webhook's {@code connection_id} is the WhatsApp Call Control application. */
    public boolean isApplication(String payloadConnectionId) {
        return enabled() && connectionId.equals(payloadConnectionId);
    }

    public String connectionId() {
        return connectionId;
    }

    /** Meta's SIP address of the contact. */
    public String to(String contactE164) {
        return "sip:+" + digits(contactE164) + "@wa.meta.vc:5061;transport=tls";
    }

    /** The business number at Meta's SIP host. */
    public String from() {
        return "sip:+" + digits(businessNumber) + "@" + sipHost;
    }

    public String sipUsername() {
        return sipUsername;
    }

    public String sipPassword() {
        return sipPassword;
    }

    public String mediaEncryption() {
        return mediaEncryption;
    }

    public Duration ringTimeout() {
        return ringTimeout;
    }

    public String unansweredMessage() {
        return unansweredMessage;
    }

    static String digits(String number) {
        return number == null ? "" : number.replaceAll("\\D", "");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Override
    public String toString() {
        return "WhatsAppSipConfig[enabled=" + enabled() + ", sipPassword=<redacted>]";
    }
}
