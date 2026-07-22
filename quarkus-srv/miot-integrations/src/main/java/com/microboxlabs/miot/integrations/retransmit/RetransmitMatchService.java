package com.microboxlabs.miot.integrations.retransmit;

import com.microboxlabs.miot.integrations.persistence.RetransmitDeliveryRepository;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Evaluates an enriched GPS position against StreamHub {@code retransmit_config}
 * (via SQL) and enqueues outbox rows for HTTP delivery.
 */
@ApplicationScoped
public class RetransmitMatchService {

    private static final Logger LOG = Logger.getLogger(RetransmitMatchService.class);

    private final StreamhubGpsClient gpsClient;
    private final RetransmitDeliveryRepository deliveryRepository;
    private final Optional<String> defaultDestinationUrl;
    private final int maxAttempts;
    /** Optional privacy pin from env/secret (preferred over SQL seed for non-public coords). */
    private final Optional<Double> privacyPinLat;
    private final Optional<Double> privacyPinLon;
    private final Optional<String> privacyPinLabel;

    RetransmitMatchService(
            StreamhubGpsClient gpsClient,
            RetransmitDeliveryRepository deliveryRepository,
            @ConfigProperty(name = "miot.integrations.retransmit.default-url")
                    Optional<String> defaultDestinationUrl,
            @ConfigProperty(name = "miot.integrations.retransmit.max-attempts", defaultValue = "5")
                    int maxAttempts,
            @ConfigProperty(name = "miot.integrations.retransmit.privacy-pin.lat")
                    Optional<Double> privacyPinLat,
            @ConfigProperty(name = "miot.integrations.retransmit.privacy-pin.lon")
                    Optional<Double> privacyPinLon,
            @ConfigProperty(name = "miot.integrations.retransmit.privacy-pin.label")
                    Optional<String> privacyPinLabel) {
        this.gpsClient = gpsClient;
        this.deliveryRepository = deliveryRepository;
        this.defaultDestinationUrl = defaultDestinationUrl;
        this.maxAttempts = maxAttempts;
        this.privacyPinLat = privacyPinLat;
        this.privacyPinLon = privacyPinLon;
        this.privacyPinLabel = privacyPinLabel.filter(s -> s != null && !s.isBlank());
    }

    /**
     * @return number of new outbox rows inserted
     */
    public int processEnrichedMessage(String rawJson) {
        JsonObject enriched = new JsonObject(rawJson);
        // Local / listen-only: GPS SQL not configured → log only (consumer already printed body).
        if (!gpsClient.isConfigured()) {
            LOG.infof(
                    "Retransmit listen-only (GPS SQL not configured) asset_id=%s asset_data_id=%s",
                    enriched.getString("asset_id"),
                    enriched.getValue("asset_data_id"));
            return 0;
        }
        JsonObject result = gpsClient.processEnrichedPosition(enriched);
        logMatchResult(enriched, result);
        if (!result.getBoolean("forward", false)) {
            return 0;
        }

        List<JsonObject> payloads = extractPayloads(result.getValue("data"));
        int enqueued = 0;
        for (JsonObject payload : payloads) {
            if (enqueueOne(payload)) {
                enqueued++;
            }
        }
        return enqueued;
    }

    private void logMatchResult(JsonObject enriched, JsonObject result) {
        Object dataVal = result.getValue("data");
        JsonObject sample = null;
        if (dataVal instanceof JsonObject jo) {
            sample = jo;
        } else if (dataVal instanceof JsonArray arr && !arr.isEmpty() && arr.getValue(0) instanceof JsonObject jo) {
            sample = jo;
        }
        JsonObject stamped = result.getJsonObject("stamped");
        JsonObject context = sample != null ? sample.getJsonObject("context") : null;
        Object zone = sample != null
                ? sample.getValue("zone")
                : (stamped != null ? stamped.getValue("zone") : null);
        // Prefer full match context; fall back to stamped zone/trip on skip.
        Object detail = context != null ? context : stamped;
        boolean forward = result.getBoolean("forward", false);
        // Always INFO so local/prod ops can verify geofence stamp + AMS match without debug.
        LOG.infof(
                "Retransmit match asset=%s forward=%s status=%s mode=%s reason=%s zone=%s detail=%s msg=%s",
                enriched.getString("asset_id"),
                forward,
                result.getInteger("status"),
                sample != null ? sample.getString("mode") : result.getString("mode"),
                sample != null ? sample.getString("reason") : null,
                zone,
                detail,
                result.getString("message"));
    }

    private boolean enqueueOne(JsonObject payload) {
        String configId = payload.getString("config_id", "unknown");
        String assetId = payload.getString("asset_id", "unknown");
        String destination = firstNonBlank(
                payload.getString("destination_url"),
                defaultDestinationUrl.orElse(null));
        if (destination == null || destination.isBlank()) {
            LOG.warnf(
                    "Retransmit payload for config=%s asset=%s has no destination_url "
                            + "(set retransmit_config.destination.url or MIOT_INTEGRATIONS_RETRANSMIT_DEFAULT_URL)",
                    configId,
                    assetId);
            return false;
        }

        applyPrivacyPinOverride(payload);

        String dedupeKey = buildDedupeKey(payload);
        Map<String, Object> body = new LinkedHashMap<>(payload.getMap());
        body.remove("destination_url");

        boolean inserted = deliveryRepository.enqueue(
                configId,
                assetId,
                dedupeKey,
                destination,
                body,
                maxAttempts);
        if (inserted) {
            LOG.infof(
                    "Retransmit enqueued config=%s asset=%s mode=%s dedupe=%s",
                    configId,
                    assetId,
                    payload.getString("mode"),
                    dedupeKey);
        }
        return inserted;
    }

    /**
     * When mode is privacy and env pin lat/lon are set, overwrite GPS (and label).
     * Keeps sensitive coordinates out of public SQL seeds / git.
     */
    void applyPrivacyPinOverride(JsonObject payload) {
        if (payload == null || !"privacy".equalsIgnoreCase(payload.getString("mode"))) {
            return;
        }
        if (privacyPinLat.isEmpty() || privacyPinLon.isEmpty()) {
            return;
        }
        JsonObject gps = payload.getJsonObject("gps");
        if (gps == null) {
            gps = new JsonObject();
            payload.put("gps", gps);
        }
        gps.put("latitude", privacyPinLat.get());
        gps.put("longitude", privacyPinLon.get());
        gps.put("fixed", true);
        if (privacyPinLabel.isPresent()) {
            gps.put("label", privacyPinLabel.get());
        }
    }

    static List<JsonObject> extractPayloads(Object data) {
        List<JsonObject> out = new ArrayList<>();
        if (data instanceof JsonObject obj) {
            out.add(obj);
        } else if (data instanceof JsonArray arr) {
            for (int i = 0; i < arr.size(); i++) {
                Object el = arr.getValue(i);
                if (el instanceof JsonObject jo) {
                    out.add(jo);
                } else if (el instanceof Map<?, ?> map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> cast = (Map<String, Object>) map;
                    out.add(new JsonObject(cast));
                }
            }
        } else if (data instanceof Map<?, ?> map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> cast = (Map<String, Object>) map;
            out.add(new JsonObject(cast));
        }
        return out;
    }

    static String buildDedupeKey(JsonObject payload) {
        String configId = payload.getString("config_id", "unknown");
        String assetId = payload.getString("asset_id", "unknown");
        Object assetDataId = payload.getValue("asset_data_id");
        String requestId = payload.getString("request_id");
        String timestamp = String.valueOf(payload.getValue("timestamp"));
        String mode = payload.getString("mode", "full");
        String unique = assetDataId != null
                ? String.valueOf(assetDataId)
                : (requestId != null && !requestId.isBlank() ? requestId : timestamp);
        return configId + ":" + assetId + ":" + unique + ":" + mode;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a.trim();
        }
        if (b != null && !b.isBlank()) {
            return b.trim();
        }
        return null;
    }
}
