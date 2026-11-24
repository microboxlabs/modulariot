package com.microboxlabs.miot.teltonika.catalog;

/**
 * A device model the platform receives ({@code miot_teltonika.device_model}).
 *
 * @param code        identifier used at registration (e.g. FMB920, GT06N)
 * @param protocol    protocol name: {@code teltonika} for the native receiver, otherwise the Traccar
 *                    protocol name (gt06, h02, gl200...)
 * @param via         {@code native} (own receiver: activation code, commands, intensive tracking) or
 *                    {@code traccar} (through the Traccar gateway: platform approval, no commands)
 * @param traccarPort port Traccar listens on for that protocol
 * @param guideFamily parameter list the connection guide uses (native only)
 * @param verified    tested end to end; unverified models are offered with a warning
 */
public record DeviceModel(String code, String brand, String model, String protocol, String via, Integer traccarPort,
        String guideFamily, boolean verified, String notes) {

    public static final String NATIVE = "native";
    public static final String TRACCAR = "traccar";

    public boolean isNative() {
        return NATIVE.equals(via);
    }
}
