package com.microboxlabs.miot.tracking.persistence;

import cl.streamhub.gps.model.EnvelopedMessage;
import cl.streamhub.gps.model.metrics.MetricItem;
import cl.streamhub.gps.model.metrics.MetricRegistry;
import cl.streamhub.gps.model.metrics.MetricValidationResult;
import cl.streamhub.gps.model.metrics.MetricsEnvelope;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

@ApplicationScoped
public class MetricsRepository {

    private static final Logger logger = Logger.getLogger(MetricsRepository.class);

    private static final String COL_DTC_CODES = "dtc_codes";
    private static final String COL_ENGINE_FREEZE_FRAME = "engine_freeze_frame";

    private final Map<String, BiConsumer<Object, Map<String, Object>>> metricMappers = buildMetricMappers();

    private final Pool client;
    private final ObjectMapper objectMapper;

    MetricsRepository(Pool client, ObjectMapper objectMapper) {
        this.client = client;
        this.objectMapper = objectMapper;
    }

    private Map<String, BiConsumer<Object, Map<String, Object>>> buildMetricMappers() {
        Map<String, BiConsumer<Object, Map<String, Object>>> m = new HashMap<>();
        // --- POWERTRAIN ---
        m.put("engine.rpm",            (v, r) -> r.put("engine_rpm", getIntegerValue(v)));
        m.put("vehicle.speed",         (v, r) -> r.put("vehicle_speed_kph", getIntegerValue(v)));
        m.put("engine.load",           (v, r) -> r.put("engine_load_pct", getShortValue(v)));
        m.put("throttle.position",     (v, r) -> r.put("throttle_pos_pct", getShortValue(v)));
        m.put("engine.coolant_temp",   (v, r) -> r.put("coolant_temp_c", getShortValue(v)));
        m.put("engine.intake_air_temp",(v, r) -> r.put("intake_air_temp_c", getShortValue(v)));
        m.put("engine.runtime",        (v, r) -> r.put("engine_runtime_s", getIntegerValue(v)));
        m.put("engine.total_runtime",  (v, r) -> r.put("engine_total_runtime_h", getIntegerValue(v)));
        // --- FUEL ---
        m.put("fuel.level",            (v, r) -> r.put("fuel_level_pct", getShortValue(v)));
        m.put("fuel.volume",           (v, r) -> r.put("fuel_volume_ml", getFuelVolumeMilliliters(v)));
        m.put("fuel.rate",             (v, r) -> r.put("fuel_rate_mlph", getIntegerValue(v)));
        m.put("fuel.used",             (v, r) -> r.put("fuel_used_ml", getLongValue(v)));
        m.put("battery.voltage",       (v, r) -> r.put("battery_voltage_mv", getBatteryVoltageMillivolts(v)));
        m.put("engine.torque_pct",     (v, r) -> r.put("engine_torque_pct", getShortValue(v)));
        // --- MOTION ---
        m.put("vehicle.odometer",      (v, r) -> r.put("odometer_km", getLongValue(v)));
        m.put("idle.state",            (v, r) -> r.put("idle_state", getBooleanValue(v)));
        m.put("accelerator.position",  (v, r) -> r.put("accelerator_pos_pct", getShortValue(v)));
        m.put("brake.state",           (v, r) -> r.put("brake_state", getBooleanValue(v)));
        // --- DIAGNOSTIC ---
        m.put("dtc.mil_on",            (v, r) -> r.put("mil_on", getBooleanValue(v)));
        m.put("dtc.codes",             (v, r) -> r.put(COL_DTC_CODES, v));
        m.put("dtc.count",             (v, r) -> r.put("dtc_count", getIntegerValue(v)));
        m.put("engine.freeze_frame",   (v, r) -> r.put(COL_ENGINE_FREEZE_FRAME, v));
        // --- EMISSIONS ---
        m.put("fuel.trim.short",       (v, r) -> r.put("fuel_trim_short_pct", getShortValue(v)));
        m.put("fuel.trim.long",        (v, r) -> r.put("fuel_trim_long_pct", getShortValue(v)));
        m.put("emissions.lambda",      (v, r) -> r.put("lambda_ratio", getDoubleValue(v)));
        m.put("catalyst.temp",         (v, r) -> r.put("catalyst_temp_c", getShortValue(v)));
        // --- ELECTRICAL ---
        m.put("battery.current",       (v, r) -> r.put("battery_current_ma", getIntegerValue(v)));
        m.put("pto.state",             (v, r) -> r.put("pto_state", getBooleanValue(v)));
        m.put("engine.fan.state",      (v, r) -> r.put("engine_fan_state", getBooleanValue(v)));
        // --- IDENTITY ---
        m.put("vehicle.vin",           (v, r) -> r.put("vehicle_vin", v));
        m.put("vehicle.protocol",      (v, r) -> r.put("vehicle_protocol", v));
        m.put("vehicle.ecu",           (v, r) -> r.put("vehicle_ecu", v));
        return Map.copyOf(m);
    }

    private static final String INSERT_INDEMP_LEDGER = """
            INSERT INTO miot_tracking.ingest_ledger_metrics (
                client_id, device_id, request_id, request_timestamp
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (client_id, device_id, request_id) DO NOTHING
            RETURNING 1
            """;

    private static final String INSERT_METRICS_CORE_QUERY = """
            INSERT INTO miot_tracking.asset_metric_core (
                shared_client_id, asset_id, device_id, ts, asset_data_id,
                engine_rpm, vehicle_speed_kph, engine_load_pct, throttle_pos_pct, coolant_temp_c,
                intake_air_temp_c, engine_runtime_s, engine_total_runtime_h, fuel_level_pct,
                fuel_volume_ml, fuel_rate_mlph, fuel_used_ml, battery_voltage_mv, engine_torque_pct,
                odometer_km, idle_state, accelerator_pos_pct, brake_state, mil_on, dtc_count,
                fuel_trim_short_pct, fuel_trim_long_pct, lambda_ratio, catalyst_temp_c,
                battery_current_ma, pto_state, engine_fan_state, payload_schema, src, quality, seq, request_id, request_timestamp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38
            )
            ON CONFLICT (shared_client_id, asset_id, ts) DO NOTHING
            RETURNING 1
            """;

    private static final String INSERT_METRICS_EXT_QUERY = """
            INSERT INTO miot_tracking.asset_metric_ext (
                shared_client_id, asset_id, device_id, ts, asset_data_id,
                ext, payload_schema, src, request_id, request_timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (shared_client_id, asset_id, ts) DO NOTHING
            RETURNING 1
            """;

    private static final String INSERT_METRICS_DTC_QUERY = """
            INSERT INTO miot_tracking.asset_metric_dtc (
                shared_client_id, asset_id, device_id, ts, asset_data_id,
                dtc_codes, engine_freeze_frame,
                payload_schema, src, request_id, request_timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (shared_client_id, asset_id, ts) DO NOTHING
            RETURNING 1
            """;

    public boolean hasMetrics(EnvelopedMessage message) {
        try {
            List<MetricItem> metrics = message.getPayload().getMetrics().getItems();
            return metrics != null && !metrics.isEmpty();
        } catch (Exception e) {
            logger.debug("Failed to check for metrics", e);
            return false;
        }
    }

    public Uni<String> saveMetrics(MetricsEnvelope metrics, List<String> sharedClientIds,
            Long assetDataId, EnvelopedMessage envelopedMessage) {
        long metricsStart = System.currentTimeMillis();

        return processIdempotencyLedger(
                envelopedMessage.getClientId(),
                envelopedMessage.getPayload().getAssetId(),
                envelopedMessage.getRequestId(),
                envelopedMessage.getTimestamp().atOffset(ZoneOffset.UTC))
                .chain(isNew -> {
                    if (Boolean.FALSE.equals(isNew)) {
                        return Uni.createFrom().item(
                                "Metrics already processed for asset: "
                                        + envelopedMessage.getPayload().getAssetId());
                    }
                    return saveMetricsInternal(metrics, sharedClientIds, assetDataId, envelopedMessage)
                            .map(result -> {
                                long metricsEnd = System.currentTimeMillis();
                                logger.infof("METRICS_SAVE_TOTAL: %d ms - assetId: %s",
                                        metricsEnd - metricsStart,
                                        envelopedMessage.getPayload().getAssetId());
                                return result;
                            });
                });
    }

    private Uni<String> saveMetricsInternal(MetricsEnvelope metrics, List<String> sharedClientIds,
            Long assetDataId, EnvelopedMessage envelopedMessage) {
        Map<String, Object> row = new HashMap<>();
        List<MetricItem> metricItems = metrics.getItems();

        List<MetricItem> coreMetrics = metricItems.stream()
                .filter(item -> {
                    MetricValidationResult validationResult = MetricRegistry.validate(item);
                    boolean isExtension = MetricRegistry.isExtensionKey(item.getK());
                    if (!validationResult.isValid()) {
                        logger.warnf("Metric validation FAILED for key '%s' (value=%s, unit=%s): [%s] %s",
                                item.getK(), item.getV(), item.getU(),
                                validationResult.getErrorCode(), validationResult.getMessage());
                    }
                    return validationResult.isValid() && !isExtension;
                })
                .toList();

        List<MetricItem> extensionMetrics = metricItems.stream()
                .filter(item -> {
                    boolean isValid = MetricRegistry.validate(item).isValid();
                    boolean isExtension = MetricRegistry.isExtensionKey(item.getK());
                    return isValid && isExtension;
                })
                .toList();

        OffsetDateTime gpsTimestamp = envelopedMessage.getPayload().getTimestamp() != null
                ? envelopedMessage.getPayload().getTimestamp().toOffsetDateTime()
                        .atZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime()
                : envelopedMessage.getTimestamp().atOffset(ZoneOffset.UTC);

        for (MetricItem item : coreMetrics) {
            mapMetricToColumn(item, row, gpsTimestamp);
        }

        Uni<String> result = Uni.createFrom().item("No metrics saved");

        for (String sharedClientId : sharedClientIds) {
            result = processCoreMetrics(sharedClientId, envelopedMessage, assetDataId, metrics, row, coreMetrics)
                    .chain(coreResult -> processExtensionMetrics(sharedClientId, envelopedMessage,
                            assetDataId, metrics, extensionMetrics)
                            .onItem().transform(extResult -> coreResult + "; " + extResult))
                    .chain(prevResult -> processDtcMetrics(sharedClientId, envelopedMessage,
                            assetDataId, metrics, row)
                            .onItem().transform(dtcResult -> prevResult + "; " + dtcResult));
        }

        return result;
    }

    private Uni<String> processCoreMetrics(String sharedClientId, EnvelopedMessage envelopedMessage,
            Long assetDataId, MetricsEnvelope metrics, Map<String, Object> row,
            List<MetricItem> coreMetrics) {

        if (coreMetrics.isEmpty()) {
            return Uni.createFrom().item("No core metrics to process");
        }

        logger.debugf("Row map values for asset %s: %s", envelopedMessage.getPayload().getAssetId(), row);
        Tuple tuple = Tuple.tuple();

        tuple.addString(sharedClientId);                                     // $1
        tuple.addString(envelopedMessage.getPayload().getAssetId());         // $2
        tuple.addString(envelopedMessage.getPayload().getAssetId());         // $3 device_id
        tuple.addOffsetDateTime((OffsetDateTime) row.get("ts"));             // $4
        tuple.addLong(assetDataId);                                          // $5

        // POWERTRAIN
        tuple.addInteger((Integer) row.get("engine_rpm"));                   // $6
        tuple.addInteger((Integer) row.get("vehicle_speed_kph"));            // $7
        tuple.addShort((Short) row.get("engine_load_pct"));                  // $8
        tuple.addShort((Short) row.get("throttle_pos_pct"));                 // $9
        tuple.addShort((Short) row.get("coolant_temp_c"));                   // $10
        tuple.addShort((Short) row.get("intake_air_temp_c"));                // $11
        tuple.addInteger((Integer) row.get("engine_runtime_s"));             // $12
        tuple.addInteger((Integer) row.get("engine_total_runtime_h"));       // $13

        // FUEL
        tuple.addShort((Short) row.get("fuel_level_pct"));                   // $14
        tuple.addInteger((Integer) row.get("fuel_volume_ml"));               // $15
        tuple.addInteger((Integer) row.get("fuel_rate_mlph"));               // $16
        tuple.addLong((Long) row.get("fuel_used_ml"));                       // $17
        tuple.addInteger((Integer) row.get("battery_voltage_mv"));           // $18
        tuple.addShort((Short) row.get("engine_torque_pct"));                // $19

        // MOTION
        tuple.addLong((Long) row.get("odometer_km"));                        // $20
        tuple.addBoolean((Boolean) row.get("idle_state"));                   // $21
        tuple.addShort((Short) row.get("accelerator_pos_pct"));              // $22
        tuple.addBoolean((Boolean) row.get("brake_state"));                  // $23

        // DIAGNOSTICS
        tuple.addBoolean((Boolean) row.get("mil_on"));                       // $24
        tuple.addInteger((Integer) row.get("dtc_count"));                    // $25

        // EMISSIONS
        tuple.addShort((Short) row.get("fuel_trim_short_pct"));              // $26
        tuple.addShort((Short) row.get("fuel_trim_long_pct"));               // $27
        tuple.addDouble((Double) row.get("lambda_ratio"));                   // $28
        tuple.addShort((Short) row.get("catalyst_temp_c"));                  // $29

        // ELECTRICAL
        tuple.addInteger((Integer) row.get("battery_current_ma"));           // $30
        tuple.addBoolean((Boolean) row.get("pto_state"));                    // $31
        tuple.addBoolean((Boolean) row.get("engine_fan_state"));             // $32

        tuple.addString(metrics.getSchema());                                // $33
        tuple.addString((String) row.get("src"));                            // $34
        tuple.addString((String) row.get("quality"));                        // $35
        tuple.addLong(metrics.getSeq());                                     // $36
        tuple.addString(envelopedMessage.getRequestId());                    // $37
        tuple.addOffsetDateTime(envelopedMessage.getTimestamp().atOffset(ZoneOffset.UTC)); // $38

        return client.preparedQuery(INSERT_METRICS_CORE_QUERY)
                .execute(tuple)
                .onFailure()
                .invoke(failure -> logger.errorf(failure,
                        "Failed to insert core metrics - shared_client_id: %s, asset_id: %s, requestId: %s. Error: %s",
                        sharedClientId, envelopedMessage.getPayload().getAssetId(),
                        envelopedMessage.getRequestId(), failure.getMessage()))
                .onItem().transformToUni(
                        rowSet -> Uni.createFrom()
                                .item("Core metrics saved for shared_client_id: " + sharedClientId));
    }

    private Uni<String> processExtensionMetrics(String sharedClientId,
            EnvelopedMessage envelopedMessage, Long assetDataId,
            MetricsEnvelope metrics, List<MetricItem> extensionMetrics) {

        if (extensionMetrics.isEmpty()) {
            return Uni.createFrom().item("No extension metrics to process");
        }

        Uni<String> result = Uni.createFrom().item("Extension metrics processed: ");

        for (MetricItem extensionMetric : extensionMetrics) {
            result = result.chain(currentResult -> {
                try {
                    JsonObject valueJson = new JsonObject(objectMapper.writeValueAsString(extensionMetric));

                    Tuple tuple = Tuple.tuple()
                            .addString(sharedClientId)
                            .addString(envelopedMessage.getPayload().getAssetId())
                            .addString(envelopedMessage.getPayload().getAssetId())
                            .addOffsetDateTime(extensionMetric.getTs().toOffsetDateTime()
                                    .atZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime())
                            .addLong(assetDataId)
                            .addJsonObject(valueJson)
                            .addString(metrics.getSchema())
                            .addString(extensionMetric.getSrc())
                            .addString(envelopedMessage.getRequestId())
                            .addOffsetDateTime(envelopedMessage.getTimestamp().atOffset(ZoneOffset.UTC));

                    return client.preparedQuery(INSERT_METRICS_EXT_QUERY)
                            .execute(tuple)
                            .onFailure()
                            .invoke(failure -> logger.errorf(failure,
                                    "Failed to insert extension metric '%s' - shared_client_id: %s, asset_id: %s, requestId: %s. Error: %s",
                                    extensionMetric.getK(), sharedClientId,
                                    envelopedMessage.getPayload().getAssetId(),
                                    envelopedMessage.getRequestId(), failure.getMessage()))
                            .onItem().transform(rowSet -> currentResult + extensionMetric.getK() + " ");
                } catch (Exception e) {
                    logger.errorf("Failed to serialize extension metric %s: %s",
                            extensionMetric.getK(), e.getMessage());
                    return Uni.createFrom()
                            .item(currentResult + "[ERROR:" + extensionMetric.getK() + "] ");
                }
            });
        }

        return result.onItem()
                .transform(finalResult -> finalResult + "for shared_client_id: " + sharedClientId);
    }

    private Uni<String> processDtcMetrics(String sharedClientId,
            EnvelopedMessage envelopedMessage, Long assetDataId,
            MetricsEnvelope metrics, Map<String, Object> row) {

        if (row.isEmpty()) {
            return Uni.createFrom().item("No core metrics to process");
        }

        Map<String, Object> dtcMetrics = row.entrySet().stream()
                .filter(entry -> {
                    String k = entry.getKey();
                    return COL_DTC_CODES.equals(k) || COL_ENGINE_FREEZE_FRAME.equals(k);
                })
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        if (dtcMetrics.isEmpty()) {
            return Uni.createFrom().item("No DTC metrics to process");
        }

        Tuple tuple = Tuple.tuple()
                .addString(sharedClientId)
                .addString(envelopedMessage.getPayload().getAssetId())
                .addString(envelopedMessage.getPayload().getAssetId())
                .addOffsetDateTime((OffsetDateTime) row.get("ts"))
                .addLong(assetDataId)
                .addArrayOfString(dtcMetrics.get(COL_DTC_CODES) instanceof List<?> list
                        ? list.stream().map(Object::toString).toArray(String[]::new)
                        : (String[]) dtcMetrics.get(COL_DTC_CODES))
                .addString(dtcMetrics.get(COL_ENGINE_FREEZE_FRAME) != null
                        ? dtcMetrics.get(COL_ENGINE_FREEZE_FRAME).toString()
                        : null)
                .addString(metrics.getSchema())
                .addString((String) row.get("src"))
                .addString(envelopedMessage.getRequestId())
                .addOffsetDateTime(envelopedMessage.getTimestamp().atOffset(ZoneOffset.UTC));

        return client.preparedQuery(INSERT_METRICS_DTC_QUERY)
                .execute(tuple)
                .onFailure()
                .invoke(failure -> logger.errorf(failure,
                        "Failed to insert DTC metric - shared_client_id: %s, asset_id: %s, requestId: %s. Error: %s",
                        sharedClientId, envelopedMessage.getPayload().getAssetId(),
                        envelopedMessage.getRequestId(), failure.getMessage()))
                .onItem().transform(rowSet ->
                        "DTC metrics saved for shared_client_id: " + sharedClientId);
    }

    private void mapMetricToColumn(MetricItem item, Map<String, Object> row,
            OffsetDateTime fallbackTimestamp) {
        BiConsumer<Object, Map<String, Object>> mapper = metricMappers.get(item.getK());
        if (mapper != null) {
            mapper.accept(item.getV(), row);
        }
        OffsetDateTime ts = item.getTs() != null
                ? item.getTs().toOffsetDateTime().atZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime()
                : fallbackTimestamp;
        row.put("ts", ts);
        row.put("src", item.getSrc());
        row.put("quality", item.getQ());
    }

    public Uni<Boolean> processIdempotencyLedger(String clientId, String deviceId,
            String requestId, OffsetDateTime requestTs) {
        Tuple tuple = Tuple.tuple()
                .addString(clientId.replace("@clients", ""))
                .addString(deviceId)
                .addString(requestId)
                .addOffsetDateTime(requestTs);

        return client.preparedQuery(INSERT_INDEMP_LEDGER)
                .execute(tuple)
                .onFailure()
                .invoke(failure -> logger.errorf(failure,
                        "Failed to insert into ingest_ledger_metrics - clientId: %s, deviceId: %s, requestId: %s. Error: %s",
                        clientId, deviceId, requestId, failure.getMessage()))
                .onItem().transform(rowSet -> rowSet.rowCount() > 0);
    }

    // --- Value conversion helpers ---

    private static Integer getIntegerValue(Object value) {
        if (value instanceof Number number) return number.intValue();
        if (value == null) return null;
        try { return Integer.parseInt(value.toString()); } catch (NumberFormatException e) { return null; }
    }

    private static Short getShortValue(Object value) {
        if (value instanceof Number number) return number.shortValue();
        if (value == null) return null;
        try { return Short.parseShort(value.toString()); } catch (NumberFormatException e) { return null; }
    }

    private static Double getDoubleValue(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        if (value == null) return null;
        try { return Double.parseDouble(value.toString()); } catch (NumberFormatException e) { return null; }
    }

    private static Long getLongValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        if (value == null) return null;
        try { return Long.parseLong(value.toString()); } catch (NumberFormatException e) { return null; }
    }

    private static Boolean getBooleanValue(Object value) {
        if (value instanceof Boolean bool) return bool;
        if (value == null) return Boolean.FALSE;
        return Boolean.parseBoolean(value.toString());
    }

    private static Integer getBatteryVoltageMillivolts(Object value) {
        if (value instanceof Number number) return (int) (number.doubleValue() * 1000);
        if (value == null) return null;
        try { return (int) (Double.parseDouble(value.toString()) * 1000); } catch (NumberFormatException e) { return null; }
    }

    private static Integer getFuelVolumeMilliliters(Object value) {
        if (value instanceof Number number) return (int) Math.round(number.doubleValue() * 1000);
        if (value == null) return null;
        try { return (int) Math.round(Double.parseDouble(value.toString()) * 1000); } catch (NumberFormatException e) { return null; }
    }
}
