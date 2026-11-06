package com.microboxlabs.miot.integrations.telephony;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * State of WhatsApp calls beyond the ledger: the WhatsApp leg bridged to an operator's parked leg, why a call
 * failed, and the calls contacts placed to the tower. Writers hold the line's lock
 * ({@link TelephonyUsageStore#locked}).
 */
public interface WhatsAppCallStore {

    /** The WhatsApp leg of the ledger row {@code callRef}. */
    void saveLeg(String callRef, String legCallId);

    Optional<String> leg(String callRef);

    void saveFailure(String callRef, String failure);

    Optional<String> failure(String callRef);

    /** Inserts the call; a second call with the same call control id is ignored. */
    void insertInbound(InboundWhatsAppCall call);

    void updateInbound(InboundWhatsAppCall call);

    Optional<InboundWhatsAppCall> inbound(String id);

    Optional<InboundWhatsAppCall> inboundByCallControl(String callControlId);

    Optional<InboundWhatsAppCall> inboundByCallRef(String callRef);

    /** The tenant's RINGING calls, oldest first. */
    List<InboundWhatsAppCall> ringing(String tenantCode);

    /** RINGING calls created before {@code before}, of every tenant. */
    List<InboundWhatsAppCall> ringingBefore(Instant before);
}
