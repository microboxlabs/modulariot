package com.microboxlabs.miot.tracking.persistence;

import cl.streamhub.gps.model.Contact;
import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.lookup.LookupIfProperty;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.pgclient.PgPool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.ZoneOffset;
import java.util.Locale;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.tracking.enabled", stringValue = "true")
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

    private final PgPool client;
    private final ObjectMapper objectMapper;

    AssetDataRepository(PgPool client, ObjectMapper objectMapper) {
        this.client = client;
        this.objectMapper = objectMapper;
    }

    public Uni<Long> save(EnvelopedMessage message) {
        var asset = message.getPayload();

        final String clientId = message.getClientId() != null
                ? message.getClientId().replace("@clients", "")
                : null;
        if (clientId == null) {
            throw new IllegalArgumentException("ClientId cannot be null");
        }

        String pointWkt = null;
        if (asset.getGps() != null) {
            pointWkt = String.format(Locale.US, "SRID=4326;POINT(%f %f)",
                    asset.getGps().getLongitude(),
                    asset.getGps().getLatitude());
        }

        try {
            JsonObject sensorsJson = asset.getSensors() != null
                    ? new JsonObject(objectMapper.writeValueAsString(asset.getSensors()))
                    : null;
            JsonObject peripheralsJson = asset.getPeripherals() != null
                    ? new JsonObject(objectMapper.writeValueAsString(asset.getPeripherals()))
                    : null;
            JsonArray eventsJson = asset.getEvents() != null
                    ? new JsonArray(objectMapper.writeValueAsString(asset.getEvents()))
                    : null;

            String s2Token = S2Util.tokenAtLevel(
                    asset.getGps().getLatitude(),
                    asset.getGps().getLongitude(), 12);
            JsonObject s2Json = new JsonObject();
            s2Json.put("level_12", s2Token);

            return client.preparedQuery(INSERT_QUERY)
                    .execute(Tuple.from(new Object[]{
                            message.getRequestId(),
                            message.getTimestamp().atOffset(ZoneOffset.UTC),
                            clientId,
                            asset.getAssetId(),
                            asset.getType(),
                            asset.getOwner(),
                            asset.getYear(),
                            asset.getTimestamp().toOffsetDateTime(),
                            pointWkt,
                            asset.getGps().getAltitude(),
                            asset.getGps().getSpeed(),
                            asset.getGps().getHeading(),

                            asset.getTelecom() != null ? asset.getTelecom().getIccid() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getImsi() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getOperator() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getMcc() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getMnc() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getCellId() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getLac() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getSignalStrength() : null,
                            asset.getTelecom() != null ? asset.getTelecom().getGpsProvider() : null,

                            asset.getDriverInfo() != null ? asset.getDriverInfo().getDriverId() : null,
                            asset.getDriverInfo() != null ? asset.getDriverInfo().getName() : null,
                            asset.getDriverInfo() != null ? asset.getDriverInfo().getLicenseNumber() : null,
                            asset.getDriverInfo() != null ? getPhone(asset.getDriverInfo().getContact()) : null,
                            asset.getDriverInfo() != null ? getEmail(asset.getDriverInfo().getContact()) : null,
                            asset.getDriverInfo() != null ? asset.getDriverInfo().getIdButton() : null,

                            asset.getCoDriverInfo() != null ? asset.getCoDriverInfo().getDriverId() : null,
                            asset.getCoDriverInfo() != null ? asset.getCoDriverInfo().getName() : null,
                            asset.getCoDriverInfo() != null ? asset.getCoDriverInfo().getLicenseNumber() : null,
                            asset.getCoDriverInfo() != null ? getPhone(asset.getCoDriverInfo().getContact()) : null,
                            asset.getCoDriverInfo() != null ? getEmail(asset.getCoDriverInfo().getContact()) : null,
                            sensorsJson,
                            peripheralsJson,
                            eventsJson,
                            s2Json
                    }))
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

    private static String getEmail(Contact contact) {
        return contact == null ? null : contact.getEmail();
    }

    private static String getPhone(Contact contact) {
        return contact == null ? null : contact.getPhone();
    }
}
