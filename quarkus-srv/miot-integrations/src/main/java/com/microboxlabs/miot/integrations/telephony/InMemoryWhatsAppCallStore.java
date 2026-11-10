package com.microboxlabs.miot.integrations.telephony;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/** Process-local {@link WhatsAppCallStore} for unit tests. Not a CDI bean. */
public class InMemoryWhatsAppCallStore implements WhatsAppCallStore {

    private final Map<String, String> legs = new LinkedHashMap<>();
    private final Map<String, String> failures = new LinkedHashMap<>();
    private final Map<String, InboundWhatsAppCall> inbound = new LinkedHashMap<>();

    @Override
    public synchronized void saveLeg(String callRef, String legCallId) {
        legs.put(callRef, legCallId);
    }

    @Override
    public synchronized Optional<String> leg(String callRef) {
        return Optional.ofNullable(legs.get(callRef));
    }

    @Override
    public synchronized void saveFailure(String callRef, String failure) {
        failures.put(callRef, failure);
    }

    @Override
    public synchronized Optional<String> failure(String callRef) {
        return Optional.ofNullable(failures.get(callRef));
    }

    @Override
    public synchronized void insertInbound(InboundWhatsAppCall call) {
        if (inboundByCallControl(call.callControlId()).isEmpty()) inbound.put(call.id(), call);
    }

    @Override
    public synchronized void updateInbound(InboundWhatsAppCall call) {
        inbound.put(call.id(), call);
    }

    @Override
    public synchronized Optional<InboundWhatsAppCall> inbound(String id) {
        return Optional.ofNullable(inbound.get(id));
    }

    @Override
    public synchronized Optional<InboundWhatsAppCall> inboundByCallControl(String callControlId) {
        return inbound.values().stream().filter(c -> c.callControlId().equals(callControlId)).findFirst();
    }

    @Override
    public synchronized Optional<InboundWhatsAppCall> inboundByCallRef(String callRef) {
        return inbound.values().stream().filter(c -> Objects.equals(c.callRef(), callRef)).findFirst();
    }

    @Override
    public synchronized List<InboundWhatsAppCall> ringing(String tenantCode) {
        return inbound.values().stream()
                .filter(c -> InboundWhatsAppCall.RINGING.equals(c.status()) && Objects.equals(c.tenantCode(), tenantCode))
                .sorted(Comparator.comparing(InboundWhatsAppCall::createdAt)).toList();
    }

    @Override
    public synchronized List<InboundWhatsAppCall> unansweredBefore(Instant before) {
        return inbound.values().stream()
                .filter(c -> (InboundWhatsAppCall.RINGING.equals(c.status()) && c.createdAt().isBefore(before))
                        || (InboundWhatsAppCall.CLAIMED.equals(c.status()) && c.updatedAt().isBefore(before)))
                .sorted(Comparator.comparing(InboundWhatsAppCall::createdAt)).toList();
    }

    @Override
    public synchronized List<InboundWhatsAppCall> activeBefore(Instant before) {
        return inbound.values().stream()
                .filter(c -> (InboundWhatsAppCall.CLAIMED.equals(c.status()) || InboundWhatsAppCall.ANSWERED.equals(c.status()))
                        && c.createdAt().isBefore(before)).toList();
    }
}
