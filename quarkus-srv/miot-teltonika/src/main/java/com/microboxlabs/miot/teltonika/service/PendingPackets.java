package com.microboxlabs.miot.teltonika.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.ingest.RecordSink;
import com.microboxlabs.miot.teltonika.ingest.RecordSink.IngestOutcome;
import com.microboxlabs.miot.teltonika.ingest.TrackingRecordSink;
import com.microboxlabs.miot.teltonika.monitor.PacketLogEntry;
import com.microboxlabs.miot.teltonika.protocol.CodecParser;
import com.microboxlabs.miot.teltonika.protocol.UdpChannel;
import com.microboxlabs.miot.teltonika.server.MqttReceiver;
import com.microboxlabs.miot.teltonika.traccar.TraccarPosition;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletionStage;

/** Publishes a kept packet again, whatever channel it came from (activation replay). */
public final class PendingPackets {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final RecordSink sink;
    private final String gpsProvider;
    private final boolean lastKnownPosition;

    public PendingPackets(RecordSink sink, String gpsProvider, boolean lastKnownPosition) {
        this.sink = sink;
        this.gpsProvider = gpsProvider;
        this.lastKnownPosition = lastKnownPosition;
    }

    /** @throws com.microboxlabs.miot.teltonika.protocol.ProtocolException or IllegalArgumentException if it cannot be decoded */
    public CompletionStage<IngestOutcome> publish(RegisteredDevice device, PacketLogEntry p) {
        byte[] raw = p.packet();
        String format = p.format() == null ? PacketLogEntry.TELTONIKA_TCP : p.format();
        return switch (format) {
            case PacketLogEntry.TELTONIKA_UDP ->
                    sink.publish(device, CodecParser.parse(UdpChannel.parse(raw).avlData()).records());
            case PacketLogEntry.TELTONIKA_MQTT -> sink.publish(device, MqttReceiver.decode(raw).records());
            case PacketLogEntry.TRACCAR_JSON -> {
                TraccarPosition pos;
                try {
                    pos = TraccarPosition.parse(JSON.readTree(raw));
                } catch (IOException e) {
                    throw new IllegalArgumentException("kept Traccar position is not JSON", e);
                }
                yield sink.publish(device, TrackingRecordSink.TRACCAR,
                        List.of(pos.candidate(gpsProvider, lastKnownPosition)));
            }
            default -> sink.publish(device, CodecParser.parse(Arrays.copyOfRange(raw, 8, raw.length - 4)).records());
        };
    }
}
