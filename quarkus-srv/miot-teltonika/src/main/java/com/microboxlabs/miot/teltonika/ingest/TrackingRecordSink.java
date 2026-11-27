package com.microboxlabs.miot.teltonika.ingest;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import cl.streamhub.gps.model.Event;
import cl.streamhub.gps.model.metrics.MetricItem;
import com.microboxlabs.miot.core.messaging.IComponentBus;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.inputs.InputInterpreter;
import com.microboxlabs.miot.teltonika.inputs.InputReading;
import com.microboxlabs.miot.teltonika.mapping.AvlRecordMapper;
import com.microboxlabs.miot.teltonika.mapping.TeltonikaIo;
import com.microboxlabs.miot.teltonika.protocol.AvlRecord;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.jboss.logging.Logger;

/**
 * Publishes each record as an {@link EnvelopedMessage}, the same message {@code /v1/asset/track}
 * produces, so the rest of the pipeline treats both alike: to the Pulsar positions topic
 * (distributed mode) and to the in-process tracking channel (standalone mode).
 *
 * <p>Per record: the asset comes from the device's assignment at the record's time, the client id
 * from the organization that registered the device. A record is not published when it has no
 * position (the tracking pipeline requires gps), when its time is outside the accepted window
 * (device clock wrong) or when no assignment covers it; the receiver keeps the raw packet for those.
 */
public final class TrackingRecordSink implements RecordSink {

    /** Same channel {@code PulsarAssetTrackingService.BUS_CHANNEL} uses in miot-tracking. */
    public static final String TRACKING_BUS_CHANNEL = "tracking.asset-positions";
    /** Width of {@code asset_data.client_id} and {@code request_id}. */
    static final int MAX_ID_LENGTH = 32;
    /** Idle devices leave the duplicate filter every this many packets. */
    private static final long EVICTION_EVERY = 10_000;

    public static final String TELTONIKA = "teltonika";
    public static final String TRACCAR = "traccar";

    private static final Logger LOG = Logger.getLogger(TrackingRecordSink.class);

    private final IMessagePublisher publisher;
    private final IComponentBus componentBus;
    private final AvlRecordMapper mapper;
    private final DuplicateFilter duplicates;
    private final String topic;
    private final Duration maxFuture;
    private final Duration maxAge;
    private final Clock clock;
    /** Over-speeding episodes in progress, by IMEI: the next ID 255 record ends the episode. */
    private final Map<String, Boolean> speeding = new ConcurrentHashMap<>();
    private final AtomicLong packets = new AtomicLong();
    private final InputInterpreter inputs = new InputInterpreter();

    public TrackingRecordSink(IMessagePublisher publisher, IComponentBus componentBus, AvlRecordMapper mapper,
            DuplicateFilter duplicates, String topic, Duration maxFuture, Duration maxAge, Clock clock) {
        this.publisher = publisher;
        this.componentBus = componentBus;
        this.mapper = mapper;
        this.duplicates = duplicates;
        this.topic = topic;
        this.maxFuture = maxFuture;
        this.maxAge = maxAge;
        this.clock = clock;
    }

    @Override
    public CompletionStage<IngestOutcome> publish(RegisteredDevice device, List<AvlRecord> records) {
        // Over-speeding episodes move only when the batch is published (a batch sent again after a
        // failure must mark the same start).
        Map<String, Boolean> speedingDraft = new HashMap<>();
        List<Candidate> candidates = new ArrayList<>(records.size());
        for (AvlRecord avl : records) {
            candidates.add(new Candidate(avl.timestamp(), AvlRecordMapper.hasPosition(avl),
                    asset -> mapper.map(avl, asset, speedingStart(device.imei(), avl, speedingDraft)),
                    InputReading.of(avl)));
        }
        return publish(device, TELTONIKA, candidates, () -> speeding.putAll(speedingDraft));
    }

    @Override
    public CompletionStage<IngestOutcome> publish(RegisteredDevice device, String source, List<Candidate> records) {
        return publish(device, source, records, () -> {
        });
    }

    private CompletionStage<IngestOutcome> publish(RegisteredDevice device, String source, List<Candidate> records,
            Runnable onPublished) {
        if (device.tenantCode() == null || device.tenantCode().isBlank()
                || device.tenantCode().length() > MAX_ID_LENGTH) {
            return CompletableFuture.failedFuture(new IllegalStateException(
                    "device " + device.imei() + " has no valid tenant code"));
        }
        Instant now = clock.instant();
        if (packets.incrementAndGet() % EVICTION_EVERY == 0) {
            int evicted = duplicates.evictIdle(now);
            speeding.keySet().retainAll(duplicates.deviceSet());
            inputs.retainAll(duplicates.deviceSet());
            LOG.debugf("Duplicate filter: %d idle devices evicted", evicted);
        }
        InputInterpreter.Batch inputBatch = inputs.batch();
        List<EnvelopedMessage> fresh = new ArrayList<>();
        List<Instant> freshTimes = new ArrayList<>();
        int dup = 0;
        int noPosition = 0;
        int outOfTime = 0;
        int unassigned = 0;
        for (Candidate c : records) {
            Instant t = c.time();
            if (t.isAfter(now.plus(maxFuture)) || t.isBefore(now.minus(maxAge))) {
                outOfTime++;
                continue;
            }
            if (!c.hasPosition()) {
                noPosition++;
                continue;
            }
            Optional<String> asset = device.assetAt(t);
            if (asset.isEmpty()) {
                unassigned++;
                continue;
            }
            if (duplicates.isPublished(device.imei(), t)) {
                dup++;
                continue;
            }
            AssetTrackingData payload = c.payload().apply(asset.get());
            if (payload.getGps() == null) {
                noPosition++;
                continue;
            }
            applyInputs(inputBatch, device, c, payload);
            fresh.add(envelope(device, source, payload, t, now));
            freshTimes.add(t);
        }
        var outcome = new IngestOutcome(fresh.size(), dup, noPosition, outOfTime, unassigned);
        if (outcome.notPublished() > 0) {
            LOG.debugf("Records not published: imei=%s, %s", device.imei(), outcome.reason());
        }
        if (fresh.isEmpty()) {
            return CompletableFuture.completedFuture(outcome);
        }
        // From here the state of inputs and episodes moves only if every record is published.
        CompletableFuture<?>[] sends = new CompletableFuture[fresh.size()];
        for (int i = 0; i < fresh.size(); i++) {
            EnvelopedMessage env = fresh.get(i);
            sends[i] = publisher.publish(topic, env.getPayload().getAssetId(), env).toCompletableFuture();
        }
        return CompletableFuture.allOf(sends).thenApply(v -> {
            inputs.commit(inputBatch);
            onPublished.run();
            freshTimes.forEach(t -> duplicates.markPublished(device.imei(), t));
            fresh.forEach(env -> componentBus.publish(TRACKING_BUS_CHANNEL, env));
            return outcome;
        });
    }

    /**
     * What is wired to the inputs: events on change and the named states in the extension metric
     * ({@code inputs}), so the Control Tower reads "Puerta trasera: abierta", not "din2: 1".
     */
    private void applyInputs(InputInterpreter.Batch batch, RegisteredDevice device, Candidate c,
            AssetTrackingData payload) {
        if (device.inputs().isEmpty()) {
            return;
        }
        InputInterpreter.Result r = inputs.apply(batch, device.imei(), device.inputs(), c.inputs(),
                payload.getTimestamp());
        if (!r.events().isEmpty()) {
            List<Event> events = payload.getEvents() == null ? new ArrayList<>() : new ArrayList<>(payload.getEvents());
            events.addAll(r.events());
            payload.setEvents(events);
        }
        if (!r.states().isEmpty() && payload.getMetrics() != null && payload.getMetrics().getItems() != null) {
            for (MetricItem item : payload.getMetrics().getItems()) {
                if (item.getK() != null && item.getK().startsWith("x.") && item.getV() instanceof Map<?, ?> values) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> io = (Map<String, Object>) values;
                    io.put("inputs", r.states());
                    break;
                }
            }
        }
    }

    /** Forgets the input state of a device whose input profile changed. */
    public void inputsChanged(String imei) {
        inputs.forget(imei);
    }

    /** Over speeding sends a record at the start and one at the end; only the start is an event. */
    private boolean speedingStart(String imei, AvlRecord avl, Map<String, Boolean> draft) {
        if (avl.eventIoId() != TeltonikaIo.OVER_SPEEDING) {
            return false;
        }
        boolean inEpisode = draft.containsKey(imei) ? draft.get(imei) : speeding.getOrDefault(imei, false);
        draft.put(imei, !inEpisode);
        return !inEpisode;
    }

    /**
     * 32 hex digits, the width of {@code asset_data.request_id}. Derived from IMEI and record
     * time, so a record the device sends again gets the same ID.
     */
    static String requestId(String imei, Instant recordTime) {
        return requestId(TELTONIKA, imei, recordTime);
    }

    static String requestId(String source, String imei, Instant recordTime) {
        UUID id = UUID.nameUUIDFromBytes((source + ":" + imei + ":" + recordTime.toEpochMilli())
                .getBytes(StandardCharsets.UTF_8));
        return id.toString().replace("-", "");
    }

    private static EnvelopedMessage envelope(RegisteredDevice device, String source, AssetTrackingData payload,
            Instant recordTime, Instant received) {
        var envelope = new EnvelopedMessage();
        envelope.setRequestId(requestId(source, device.imei(), recordTime));
        envelope.setTimestamp(received);
        envelope.setClientId(device.tenantCode());
        envelope.setPayload(payload);
        return envelope;
    }
}
