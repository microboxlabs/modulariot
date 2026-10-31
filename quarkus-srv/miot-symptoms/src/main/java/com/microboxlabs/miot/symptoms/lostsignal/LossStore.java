package com.microboxlabs.miot.symptoms.lostsignal;

/** The lost-signal detector's state: in Redis, or in memory for one replica and for tests. */
public interface LossStore {

    /** @param vehicle null for a vehicle never seen; {@code sender} null for a sender never seen or unknown */
    record Profiles(VehicleProfile vehicle, SenderProfile sender) {
    }

    /** @param sender null when the frame names none */
    Profiles load(String assetId, String sender);

    /** @param senderProfile ignored when {@code sender} is null */
    void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile);
}
