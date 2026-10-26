package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.Delivery;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The deliveries of trips, their steps and proofs. A step without a row is open. */
public interface DeliveryStore {

    /** The trip's deliveries, oldest first. */
    List<Delivery> list(String tenantCode, UUID tripId);

    /** Inside a transaction the row stays locked until it ends. */
    Optional<Delivery> find(String tenantCode, UUID tripId, UUID deliveryId);

    Optional<Delivery> findByReference(String tenantCode, UUID tripId, String reference);

    /** Inserts the delivery and the mandates it covers. */
    Delivery insert(Delivery delivery);

    /** Replaces customer, evidence and note. */
    Delivery update(Delivery delivery);

    /** Every recorded step of the trip's deliveries. */
    List<Delivery.Step> steps(String tenantCode, UUID tripId);

    Optional<Delivery.Step> step(String tenantCode, UUID deliveryId, String step);

    /** Creates or replaces the step's row. */
    Delivery.Step save(Delivery.Step step);

    /** Every proof of the trip's deliveries, oldest first. */
    List<Delivery.Proof> proofs(String tenantCode, UUID tripId);

    Delivery.Proof insert(Delivery.Proof proof);
}
