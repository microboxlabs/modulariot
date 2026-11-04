package com.microboxlabs.miot.integrations.telephony;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Who a call to the shared number belongs to: the organization of the latest managed call to that caller in the
 * last {@link #WINDOW}. Empty means the platform's voicemail or notice. Only the decision is made here; answering
 * and transferring the call needs a Telnyx Call Control application (see the telephony doc).
 */
@ApplicationScoped
public class InboundRouter {

    static final Duration WINDOW = Duration.ofHours(24);

    private final TelephonyUsageStore usage;

    @Inject
    public InboundRouter(TelephonyUsageStore usage) {
        this.usage = usage;
    }

    public Optional<String> route(String callerNumber, Instant at) {
        String digits = callerNumber == null ? "" : callerNumber.replaceAll("\\D", "");
        if (digits.length() < 8) {
            return Optional.empty();
        }
        Instant now = at == null ? Instant.now() : at;
        return usage.latestCallerTenant(digits, now.minus(WINDOW));
    }
}
