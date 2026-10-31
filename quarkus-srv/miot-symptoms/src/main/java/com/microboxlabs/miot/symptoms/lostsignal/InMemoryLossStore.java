package com.microboxlabs.miot.symptoms.lostsignal;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local lost-signal state, for tests and for one replica without Redis. */
public class InMemoryLossStore implements LossStore {

    private final Map<String, VehicleProfile> vehicles = new ConcurrentHashMap<>();
    private final Map<String, SenderProfile> senders = new ConcurrentHashMap<>();

    @Override
    public Profiles load(String assetId, String sender) {
        return new Profiles(vehicles.get(assetId), sender == null ? null : senders.get(sender));
    }

    @Override
    public void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile) {
        vehicles.put(assetId, vehicle);
        if (sender != null) {
            senders.put(sender, senderProfile);
        }
    }
}
