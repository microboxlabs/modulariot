package com.microboxlabs.miot.teltonika.catalog;

import com.microboxlabs.miot.teltonika.device.DeviceRegistry;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import java.util.Locale;
import java.util.Optional;

/**
 * Each device reports through the channel of its model, and only that one: a native Teltonika is
 * heard by the native receivers (TCP, UDP, MQTT), a brand of the Traccar gateway only through
 * Traccar and with its model's protocol. Without this, anyone who knows an IMEI could send positions
 * for it through a channel that cannot prove possession (an OsmAnd request carries only the id).
 */
public final class ChannelRules {

    private ChannelRules() {
    }

    /** The registry as the native receivers see it: devices of Traccar models are not there. */
    public static DeviceRegistry nativeView(DeviceRegistry registry, ModelCatalog catalog) {
        return new DeviceRegistry() {
            @Override
            public Optional<RegisteredDevice> find(String imei) {
                return registry.find(imei).filter(d -> DeviceModel.NATIVE.equals(catalog.via(d.model())));
            }

            @Override
            public void invalidate(String imei) {
                registry.invalidate(imei);
            }
        };
    }

    /**
     * Whether a position Traccar decoded with {@code protocol} may belong to {@code device}: its model
     * is a Traccar model and the protocol is the model's (when Traccar names it).
     */
    public static boolean traccarAccepts(ModelCatalog catalog, RegisteredDevice device, String protocol) {
        Optional<DeviceModel> model = catalog.find(device.model());
        if (model.isEmpty() || model.get().isNative()) {
            return false;
        }
        return protocol == null || protocol.isBlank()
                || model.get().protocol().equalsIgnoreCase(protocol.trim().toLowerCase(Locale.ROOT));
    }
}
