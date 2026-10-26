package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** What the API returns for deliveries. */
public final class DeliveryViews {

    private DeliveryViews() {
    }

    /** The trip's cycle, its deliveries and the mandates no delivery covers yet. */
    public record Deliveries(DeliveryCycle cycle, List<Delivery> deliveries, List<Mandate> uncovered) {
    }

    public record Mandate(String id, String code) {
    }

    /** A delivery with every step of the cycle, open ones included, and its proofs. */
    public record Delivery(
            String id,
            String reference,
            String customer,
            String source,
            Map<String, Object> evidence,
            String note,
            List<Mandate> mandates,
            List<com.microboxlabs.miot.trips.domain.Delivery.Step> steps,
            List<com.microboxlabs.miot.trips.domain.Delivery.Proof> proofs,
            OffsetDateTime createdAt,
            String createdBy) {

        public static Delivery of(com.microboxlabs.miot.trips.domain.Delivery d, DeliveryCycle cycle,
                Map<String, String> codes, List<com.microboxlabs.miot.trips.domain.Delivery.Step> steps,
                List<com.microboxlabs.miot.trips.domain.Delivery.Proof> proofs) {
            List<com.microboxlabs.miot.trips.domain.Delivery.Step> mine = cycle.steps().stream()
                    .map(s -> steps.stream().filter(x -> x.deliveryId().equals(d.id()) && x.step().equals(s))
                            .findFirst()
                            .orElse(com.microboxlabs.miot.trips.domain.Delivery.Step.unrecorded(d.tenantCode(),
                                    d.id(), s)))
                    .toList();
            return new Delivery(d.id(), d.reference(), d.customer(), d.source(), d.evidence(), d.note(),
                    d.mandateIds().stream().map(id -> new Mandate(id, codes.get(id))).toList(), mine,
                    proofs.stream().filter(p -> p.deliveryId().equals(d.id())).toList(), d.createdAt(),
                    d.createdBy());
        }
    }
}
