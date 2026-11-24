package com.microboxlabs.miot.teltonika.config;

import com.microboxlabs.miot.core.messaging.IComponentBus;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.command.CommandStore;
import com.microboxlabs.miot.teltonika.device.CachedDeviceRegistry;
import com.microboxlabs.miot.teltonika.device.DeviceStore;
import com.microboxlabs.miot.teltonika.guide.ConnectionGuide;
import com.microboxlabs.miot.teltonika.ingest.DuplicateFilter;
import com.microboxlabs.miot.teltonika.ingest.RecordSink;
import com.microboxlabs.miot.teltonika.ingest.TrackingRecordSink;
import com.microboxlabs.miot.teltonika.mapping.AvlRecordMapper;
import com.microboxlabs.miot.teltonika.monitor.DeviceMonitor;
import com.microboxlabs.miot.teltonika.monitor.MonitorStore;
import com.microboxlabs.miot.teltonika.server.SessionRegistry;
import com.microboxlabs.miot.teltonika.service.ActivationService;
import com.microboxlabs.miot.teltonika.service.DeviceService;
import com.microboxlabs.miot.teltonika.device.AssetDirectory;
import com.microboxlabs.miot.teltonika.catalog.ModelCatalog;
import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import com.microboxlabs.miot.teltonika.profile.ProfileStore;
import com.microboxlabs.miot.teltonika.service.PendingPackets;
import com.microboxlabs.miot.teltonika.service.ProfileService;
import com.microboxlabs.miot.teltonika.traccar.TraccarIngest;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;
import java.time.Clock;
import java.util.Map;

/**
 * The module's objects that are plain classes (so tests build them without CDI), produced once
 * per application ({@code @Singleton}: no client proxy for final classes). Same activation as the
 * rest of the module.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class TeltonikaBeans {

    /** Not a bean: a Clock producer would be visible to every module of the modulith. */
    static final Clock CLOCK = Clock.systemUTC();

    @Produces
    @Singleton
    CachedDeviceRegistry registry(DeviceStore store) {
        return new CachedDeviceRegistry(store);
    }

    @Produces
    @Singleton
    SessionRegistry sessions() {
        return new SessionRegistry();
    }

    @Produces
    @Singleton
    DeviceMonitor monitor(MonitorStore store, TeltonikaConfig config) {
        return new DeviceMonitor(store, config.packetQueueSize());
    }

    @Produces
    @Singleton
    ConnectionGuide guide(TeltonikaConfig config) {
        return new ConnectionGuide(config.publicHost(), config.publicPort(),
                config.traccarPublicHost().orElse(config.publicHost()));
    }

    @Produces
    @Singleton
    RecordSink sink(IMessagePublisher publisher, IComponentBus bus, TeltonikaConfig config) {
        return new TrackingRecordSink(publisher, bus,
                new AvlRecordMapper(config.gpsProvider(), config.publishLastKnownPosition()),
                new DuplicateFilter(config.duplicateWindow(), config.duplicateIdleEviction()),
                config.topic(), config.maxFutureSkew(), config.maxRecordAge(), CLOCK);
    }

    @Produces
    @Singleton
    CommandService commands(CommandStore store, DeviceStore devices, ProfileStore profiles) {
        return new CommandService(store, CLOCK, imei -> devices.find(imei)
                .map(Device::configProfileId)
                .flatMap(profiles::configProfile)
                .map(ConfigProfile::params)
                .orElse(Map.of()));
    }

    @Produces
    @Singleton
    DeviceService devices(DeviceStore devices, MonitorStore monitor, CommandStore commandStore,
            CommandService commands, CachedDeviceRegistry registry, ConnectionGuide guide, AssetDirectory assets,
            TeltonikaConfig config, ModelCatalog catalog, ProfileStore profiles) {
        return new DeviceService(devices, monitor, commandStore, commands, registry, guide, assets,
                new DeviceService.Settings(config.activationRequired(), config.claimTtl(), config.assignmentBackfill()),
                CLOCK, catalog, profiles);
    }

    @Produces
    @Singleton
    ProfileService profiles(ProfileStore store, CachedDeviceRegistry registry) {
        return new ProfileService(store, registry::reload, CLOCK);
    }

    @Produces
    @Singleton
    TraccarIngest traccar(CachedDeviceRegistry registry, RecordSink sink, DeviceMonitor monitor,
            TeltonikaConfig config, ModelCatalog catalog) {
        return new TraccarIngest(registry, sink, monitor, config.gpsProvider(), config.publishLastKnownPosition(),
                config.publishTimeout(), CLOCK, catalog);
    }

    @Produces
    @Singleton
    ActivationService activation(DeviceStore devices, MonitorStore monitor, CommandStore commandStore,
            CommandService commands, CachedDeviceRegistry registry, RecordSink sink, ModelCatalog catalog,
            TeltonikaConfig config) {
        return new ActivationService(devices, monitor, commandStore, commands, registry,
                new PendingPackets(sink, config.gpsProvider(), config.publishLastKnownPosition()), catalog, CLOCK);
    }
}
