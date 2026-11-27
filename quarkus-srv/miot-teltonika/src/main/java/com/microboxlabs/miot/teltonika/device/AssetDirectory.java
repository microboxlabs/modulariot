package com.microboxlabs.miot.teltonika.device;

/**
 * Whether an organization may assign a device to an asset. An asset (license plate) another
 * organization already receives data for, and this one does not, is refused: registering a device
 * must not inject positions into someone else's vehicle.
 */
@FunctionalInterface
public interface AssetDirectory {

    boolean mayAssign(String tenantCode, String assetId);

    /** No fleet data to check against: every asset is allowed. */
    static AssetDirectory open() {
        return (tenant, asset) -> true;
    }
}
