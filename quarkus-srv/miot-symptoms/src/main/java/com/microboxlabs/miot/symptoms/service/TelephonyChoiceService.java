package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.telephony.InboundCall;
import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import com.microboxlabs.miot.symptoms.store.TowerSettingsStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Which telephony connection the organization's calls use. The organization may choose TEAMS_PHONE or
 * TELNYX; the chosen one is used when its connection passed its test, else Telnyx, else Teams Phone.
 * No line means the calls open the phone's own dialer.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TelephonyChoiceService {

    /**
     * @param preferred what the organization chose, or null
     * @param active    the line calls use now, or null when none is ready
     * @param lines     every telephony connection of the organization, ready or not
     * @param whatsAppCalling whether the WhatsApp button calls from the browser; false opens the chat
     */
    public record TelephonySetup(TelephonyProvider preferred, TelephonyLine active, List<TelephonyLine> lines,
            boolean whatsAppCalling) {
    }

    /** {@code provider}: TELNYX, TEAMS_PHONE, or null to let the server pick. */
    public record TelephonyRequest(String provider) {
    }

    private final TowerSettingsStore store;
    private final Telephony telephony;
    private final AuditService audit;

    @Inject
    public TelephonyChoiceService(TowerSettingsStore store, Telephony telephony, AuditService audit) {
        this.store = store;
        this.telephony = telephony;
        this.audit = audit;
    }

    public TelephonySetup get(String tenantCode) {
        TelephonyProvider preferred = store.telephonyProvider(tenantCode).map(TelephonyProvider::valueOf)
                .orElse(null);
        List<TelephonyLine> lines = telephony.lines(tenantCode);
        TelephonyLine active = pick(preferred, lines).orElse(null);
        return new TelephonySetup(preferred, active, lines, whatsAppCalling(tenantCode, active));
    }

    /** The line calls use now, if any. */
    public Optional<TelephonyLine> active(String tenantCode) {
        return Optional.ofNullable(get(tenantCode).active());
    }

    /**
     * A Telnyx WebRTC login for the operator, on the line calls use now.
     *
     * @throws TelephonyUnavailableException when that line is not Telnyx, or Telnyx refuses
     */
    public WebRtcToken webRtcToken(String tenantCode, String operator) {
        return webRtcToken(tenantCode, operator, null);
    }

    /**
     * {@code req}: the number to call and the case, for the usage ledger; may be null. With {@code channel}
     * WHATSAPP the server calls the number on WhatsApp once the operator's leg is admitted.
     */
    public WebRtcToken webRtcToken(String tenantCode, String operator, CallRequest req) {
        TelephonyLine line = telnyxLine(tenantCode);
        if (req != null && WHATSAPP.equalsIgnoreCase(req.channel())) {
            return telephony.whatsAppCall(tenantCode, line.connectionId(), operator, req.calleeNumber(),
                    req.caseRef());
        }
        return telephony.webRtcToken(tenantCode, line.connectionId(), operator,
                req == null ? null : req.calleeNumber(), req == null ? null : req.caseRef());
    }

    /** The WhatsApp calls ringing in the tower. */
    public List<InboundCall> ringingWhatsAppCalls(String tenantCode) {
        return telephony.ringingWhatsAppCalls(tenantCode);
    }

    /** A login to take a ringing WhatsApp call; the operator dials with it like any Telnyx call. */
    public WebRtcToken answerWhatsAppCall(String tenantCode, String operator, String inboundCallId) {
        return telephony.answerWhatsAppCall(tenantCode, telnyxLine(tenantCode).connectionId(), operator,
                inboundCallId);
    }

    /** Why the provider ended the call before it connected, or null. */
    public CallOutcome outcome(String tenantCode, String callRef) {
        return new CallOutcome(telephony.callFailure(tenantCode, callRef).orElse(null));
    }

    public record CallOutcome(String failure) {
    }

    private TelephonyLine telnyxLine(String tenantCode) {
        return active(tenantCode)
                .filter(l -> l.provider() == TelephonyProvider.TELNYX)
                .orElseThrow(() -> new TelephonyUnavailableException("The organization's calls do not use Telnyx"));
    }

    private boolean whatsAppCalling(String tenantCode, TelephonyLine active) {
        return active != null && active.provider() == TelephonyProvider.TELNYX && active.managed()
                && telephony.whatsAppCalling(tenantCode);
    }

    static final String WHATSAPP = "WHATSAPP";

    /** The browser says the call ended; the billed seconds still come from Telnyx. */
    public void callEnded(String tenantCode, String callRef, CallEnded req) {
        telephony.callEnded(tenantCode, callRef, req == null ? null : req.providerCallId());
    }

    /** {@code channel}: WHATSAPP, or null for the phone network. */
    public record CallRequest(String calleeNumber, String caseRef, String channel) {

        public CallRequest(String calleeNumber, String caseRef) {
            this(calleeNumber, caseRef, null);
        }
    }

    public record CallEnded(String providerCallId) {
    }

    public TelephonySetup save(String tenantCode, String actor, TelephonyRequest req) {
        TelephonyProvider provider = parse(req == null ? null : req.provider());
        List<TelephonyLine> lines = telephony.lines(tenantCode);
        TelephonyLine active = pick(provider, lines).orElse(null);
        TelephonySetup saved = new TelephonySetup(provider, active, lines, whatsAppCalling(tenantCode, active));
        store.saveTelephonyProvider(tenantCode, provider == null ? null : provider.name(), actor);
        audit.log(tenantCode, actor, "settings.telephony_saved", "settings", tenantCode, null,
                Map.of("provider", provider == null ? "AUTO" : provider.name()));
        return saved;
    }

    static Optional<TelephonyLine> pick(TelephonyProvider preferred, List<TelephonyLine> lines) {
        List<TelephonyLine> ready = lines.stream().filter(TelephonyLine::ready).toList();
        for (TelephonyProvider p : order(preferred)) {
            Optional<TelephonyLine> line = ready.stream().filter(l -> l.provider() == p).findFirst();
            if (line.isPresent()) {
                return line;
            }
        }
        return Optional.empty();
    }

    private static List<TelephonyProvider> order(TelephonyProvider preferred) {
        if (preferred == TelephonyProvider.TEAMS_PHONE) {
            return List.of(TelephonyProvider.TEAMS_PHONE, TelephonyProvider.TELNYX);
        }
        return List.of(TelephonyProvider.TELNYX, TelephonyProvider.TEAMS_PHONE);
    }

    private static TelephonyProvider parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return TelephonyProvider.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("provider: TELNYX, TEAMS_PHONE or null");
        }
    }
}
