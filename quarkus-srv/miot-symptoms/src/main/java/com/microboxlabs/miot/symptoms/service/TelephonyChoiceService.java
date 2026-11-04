package com.microboxlabs.miot.symptoms.service;

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
     */
    public record TelephonySetup(TelephonyProvider preferred, TelephonyLine active, List<TelephonyLine> lines) {
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
        return new TelephonySetup(preferred, pick(preferred, lines).orElse(null), lines);
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

    /** {@code req}: the number to call and the case, for the usage ledger; may be null. */
    public WebRtcToken webRtcToken(String tenantCode, String operator, CallRequest req) {
        TelephonyLine line = active(tenantCode)
                .filter(l -> l.provider() == TelephonyProvider.TELNYX)
                .orElseThrow(() -> new TelephonyUnavailableException("The organization's calls do not use Telnyx"));
        return telephony.webRtcToken(tenantCode, line.connectionId(), operator,
                req == null ? null : req.calleeNumber(), req == null ? null : req.caseRef());
    }

    /** The browser says the call ended; the billed seconds still come from Telnyx. */
    public void callEnded(String tenantCode, String callRef, CallEnded req) {
        telephony.callEnded(tenantCode, callRef, req == null ? null : req.providerCallId());
    }

    public record CallRequest(String calleeNumber, String caseRef) {
    }

    public record CallEnded(String providerCallId) {
    }

    public TelephonySetup save(String tenantCode, String actor, TelephonyRequest req) {
        TelephonyProvider provider = parse(req == null ? null : req.provider());
        store.saveTelephonyProvider(tenantCode, provider == null ? null : provider.name(), actor);
        audit.log(tenantCode, actor, "settings.telephony_saved", "settings", tenantCode, null,
                Map.of("provider", provider == null ? "AUTO" : provider.name()));
        return get(tenantCode);
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
