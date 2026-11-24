package com.microboxlabs.miot.teltonika.monitor;

import java.time.OffsetDateTime;

/**
 * Health of one device ({@code miot_teltonika.device_status}): when it was last heard, the last
 * values that tell whether it is installed right, and its error counters. Written by the receiver
 * in batches, read by the health and installation-check endpoints.
 */
public record DeviceStatus(
        String imei,
        OffsetDateTime firstSeenAt,
        OffsetDateTime lastSeenAt,
        OffsetDateTime lastRecordAt,
        String lastRemoteAddress,
        long connections,
        long packets,
        long recordsPublished,
        long crcErrors,
        long quarantinedPackets,
        long recordsWithoutPosition,
        long recordsOutOfTime,
        Double lastLatitude,
        Double lastLongitude,
        OffsetDateTime lastFixAt,
        Integer lastGnssStatus,
        Integer lastSatellites,
        Integer lastGsmSignal,
        Integer lastExternalVoltageMv,
        Integer lastBatteryVoltageMv,
        Integer lastSleepMode,
        Integer lastDataMode,
        Boolean lastIgnition,
        OffsetDateTime ignitionOnSeenAt,
        OffsetDateTime ignitionOffSeenAt,
        String lastIbutton,
        OffsetDateTime lastIbuttonAt,
        Integer lastRecordIntervalS) {
}
