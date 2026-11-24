package com.microboxlabs.miot.teltonika.device;

import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Devices and their asset assignments. Blocking; callers run off the event loop.
 * Tenant-scoped reads take the organization's tenant code; the receiver reads every active device.
 */
public interface DeviceStore {

    Optional<Device> find(String imei);

    List<Device> list(String tenantCode, Boolean active);

    /** Inserts the device and its first assignment in one transaction. */
    void register(Device device, String assetId, OffsetDateTime assignedFrom, String actor);

    /** Deletes a device whose claim expired, with everything that hangs from it. */
    void deleteExpiredClaim(String imei);

    /** Model, label, active, activation, capture window and profiles; false when the device does not exist. */
    boolean update(Device device);

    List<Assignment> assignments(String imei);

    /** Closes the open assignment at {@code at} (if any) and opens one for {@code assetId} from {@code at}. */
    void reassign(String imei, String assetId, OffsetDateTime at, String actor);

    /** Closes the open assignment at {@code at}; used when the device is deactivated. */
    void closeAssignment(String imei, OffsetDateTime at);

    /** Every active device (activated or pending) with its assignments and inputs, for the receiver's registry. */
    List<RegisteredDevice> activeDevices();

    /** The mappings of an input profile; empty for null. */
    List<InputMapping> inputMappings(UUID inputProfileId);

    /** Pending claims of every organization, oldest first (platform approval). */
    List<Device> pendingClaims();
}
