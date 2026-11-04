package com.microboxlabs.miot.conversational.calling;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Whether WhatsApp Business calling is on: {@code miot.conversational.whatsapp.calling.enabled}, off by default.
 * While it is off nothing in this package sends a request or reads a {@code calls} webhook. See
 * {@code miot-conversational/docs/whatsapp-calling.md}.
 */
@ApplicationScoped
public class WhatsAppCallingSettings {

    private final boolean enabled;

    @Inject
    public WhatsAppCallingSettings(
            @ConfigProperty(name = "miot.conversational.whatsapp.calling.enabled", defaultValue = "false")
            boolean enabled) {
        this.enabled = enabled;
    }

    public boolean enabled() {
        return enabled;
    }

    /** @throws IllegalStateException while calling is off */
    public void requireEnabled() {
        if (!enabled) {
            throw new IllegalStateException("WhatsApp calling is not enabled");
        }
    }
}
