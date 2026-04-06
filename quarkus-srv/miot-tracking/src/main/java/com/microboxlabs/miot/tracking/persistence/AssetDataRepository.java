package com.microboxlabs.miot.tracking.persistence;

import cl.streamhub.gps.model.Contact;
import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.ZoneOffset;
import java.util.Locale;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AssetDataRepository {

    private static final Logger logger = Logger.getLogger(AssetDataRepository.class);

    private static final String INSERT_QUERY = """
            INSERT INTO miot_tracking.asset_data (
            request_id, request_timestamp, client_id,
            asset_id, type, owner, year, timestamp, location, altitude, speed, heading,
            telcom_iccid, telcom_imsi, telcom_operator, telcom_mcc, telcom_mnc,
            telcom_cell_id, telcom_lac, telcom_signal_strength, telcom_gps_provider,
            driver_info_driver_id, driver_info_name, driver_info_license_number,
            driver_info_contact_phone, driver_info_contact_email,
            driver_info_id_button,
            co_driver_info_driver_id, co_driver_info_name, co_driver_info_license_number,
            co_driver_info_contact_phone, co_driver_info_contact_email,
            sensors, peripherals, events, s2tokens)
            VALUES (
            $1, $2, $3,
            $4, $5, $6, $7, $8, ST_GeographyFromText($9), $10, $11, $12,
            $13, $14, $15, $16, $17,
            $18, $19, $20, $21,
            $22, $23, $24,
            $25, $26,
            $27,
            $28, $29, $30,
            $31, $32,
            $33::jsonb, $34::jsonb, $35::jsonb, $36::jsonb)
            RETURNING id
            """;

    private final Pool client;
    private final ObjectMapper objectMapper;

    AssetDataRepository(Pool client, ObjectMapper objectMapper) {
        this.client = client;
        this.objectMapper = objectMapper;
    }

    public Uni<Long> save(EnvelopedMessage message) {
        var asset = message.getPayload();

        final String clientId = extractClientId(message);
        String pointWkt = buildPointWkt(asset);

        try {
            Object[] params = buildInsertParams(message, asset, clientId, pointWkt);

            return client.preparedQuery(INSERT_QUERY)
                    .execute(Tuple.from(params))
                    .onFailure()
                    .invoke(failure -> logger.errorf(failure,
                            "Failed to insert into asset_data - assetId: %s, requestId: %s, clientId: %s. Error: %s",
                            asset.getAssetId(), message.getRequestId(), clientId,
                            failure.getMessage()))
                    .map(rows -> rows.iterator().next().getLong("id"));
        } catch (JsonProcessingException e) {
            return Uni.createFrom().failure(e);
        }
    }

    private static String extractClientId(EnvelopedMessage message) {
        String raw = message.getClientId();
        String clientId = raw != null ? raw.replace("@clients", "") : null;
        if (clientId == null) {
            throw new IllegalArgumentException("ClientId cannot be null");
        }
        return clientId;
    }

    private static String buildPointWkt(cl.streamhub.gps.model.AssetTrackingData asset) {
        if (asset.getGps() == null) return null;
        return String.format(Locale.US, "SRID=4326;POINT(%f %f)",
                asset.getGps().getLongitude(), asset.getGps().getLatitude());
    }

    private Object[] buildInsertParams(EnvelopedMessage message,
            cl.streamhub.gps.model.AssetTrackingData asset,
            String clientId, String pointWkt) throws JsonProcessingException {

        JsonObject sensorsJson = toJsonObject(asset.getSensors());
        JsonObject peripheralsJson = toJsonObject(asset.getPeripherals());
        JsonArray eventsJson = asset.getEvents() != null
                ? new JsonArray(objectMapper.writeValueAsString(asset.getEvents()))
                : null;

        String s2Token = S2Util.tokenAtLevel(
                asset.getGps().getLatitude(), asset.getGps().getLongitude(), 12);
        JsonObject s2Json = new JsonObject().put("level_12", s2Token);

        Object[] telecomParams = telecomParams(asset.getTelecom());
        Object[] driverParams = driverInfoParams(asset.getDriverInfo());
        Object[] coDriverParams = driverInfoParams(asset.getCoDriverInfo());

        return new Object[]{
                message.getRequestId(),
                message.getTimestamp().atOffset(ZoneOffset.UTC),
                clientId,
                asset.getAssetId(), asset.getType(), asset.getOwner(), asset.getYear(),
                asset.getTimestamp().toOffsetDateTime(),
                pointWkt,
                asset.getGps().getAltitude(), asset.getGps().getSpeed(), asset.getGps().getHeading(),
                telecomParams[0], telecomParams[1], telecomParams[2], telecomParams[3],
                telecomParams[4], telecomParams[5], telecomParams[6], telecomParams[7],
                telecomParams[8],
                driverParams[0], driverParams[1], driverParams[2],       // $22-$24
                driverParams[3], driverParams[4], driverParams[5],       // $25-$27
                coDriverParams[0], coDriverParams[1], coDriverParams[2], // $28-$30
                coDriverParams[3], coDriverParams[4],                    // $31-$32
                sensorsJson, peripheralsJson, eventsJson, s2Json
        };
    }

    private static Object[] telecomParams(cl.streamhub.gps.model.Telecom t) {
        if (t == null) return new Object[9];
        return new Object[]{
                t.getIccid(), t.getImsi(), t.getOperator(), t.getMcc(), t.getMnc(),
                t.getCellId(), t.getLac(), t.getSignalStrength(), t.getGpsProvider()
        };
    }

    private static Object[] driverInfoParams(cl.streamhub.gps.model.DriverInfo d) {
        if (d == null) return new Object[6];
        return new Object[]{
                d.getDriverId(), d.getName(), d.getLicenseNumber(),
                getPhone(d.getContact()), getEmail(d.getContact()), d.getIdButton()
        };
    }

    private JsonObject toJsonObject(Object value) throws JsonProcessingException {
        return value != null ? new JsonObject(objectMapper.writeValueAsString(value)) : null;
    }

    private static String getEmail(Contact contact) {
        return contact == null ? null : contact.getEmail();
    }

    private static String getPhone(Contact contact) {
        return contact == null ? null : contact.getPhone();
    }
}
