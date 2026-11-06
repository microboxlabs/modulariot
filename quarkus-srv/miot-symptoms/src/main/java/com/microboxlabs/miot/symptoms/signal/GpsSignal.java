package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.AssetTrackingData;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * {@code miot.gps.signal@1}: one GPS frame as symptom rules read it, under the
 * CEL root {@code signal}. {@code frame} is the frame as the device sent it;
 * the other parts are what the signal builder adds from the trip, the vehicle,
 * the road network and the zones. A part the builder does not know is null.
 *
 * <p>The builder publishes each client's trip in {@code trips}, keyed by
 * client; the evaluator gives each organization's rules its own as
 * {@code trip}, so one organization never reads another's trip.
 *
 * <p>The rule editor's fields for the {@code gps_signal} source are read from
 * these annotations ({@link SignalFields}): {@code title} is the label,
 * {@code x-unit}, {@code x-origin} and {@code x-type} add to the Java type, and
 * {@code x-engine: false} marks a field the engine does not evaluate yet.
 */
@Schema(title = "Señal GPS enriquecida", extensions = {
        @Extension(name = "x-cadence", value = "Cada pulso GPS, del orden de 30 s por camión") })
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
@RegisterForReflection
public record GpsSignal(
        @Schema(hidden = true) String schema,
        @Schema(title = "Vehículo", extensions = @Extension(name = "x-origin", value = "DEVICE"))
        @JsonProperty("asset_id") String assetId,
        @Schema(hidden = true) Instant at,
        @Schema(hidden = true) @JsonProperty("received_at") Instant receivedAt,
        @Schema(hidden = true) List<String> clients,
        @Schema(hidden = true) String sender,
        @Schema(hidden = true) Map<String, Trip> trips,
        Trip trip,
        Vehicle vehicle,
        Road road,
        Geo geo,
        @Schema(hidden = true) Map<String, Geo> geos,
        @Schema(title = "Hora local") @JsonProperty("local_hour") Integer localHour,
        @Schema(title = "Minutos del día", description = "Minutos desde la medianoche local, con los segundos "
                + "como fracción: 01:30:30 es 90,5", extensions = @Extension(name = "x-unit", value = "min"))
        @JsonProperty("local_minutes") Double localMinutes,
        Derived derived,
        @Schema(extensions = @Extension(name = "x-origin", value = "DEVICE")) AssetTrackingData frame) {

    public static final String SCHEMA_ID = "miot.gps.signal@1";
    /**
     * A signal that carries only device events received outside the GPS frames ({@code DeviceEvents}): no position,
     * no sensors. The evaluator runs on it only the symptoms that read device events.
     */
    public static final String EVENTS_SCHEMA_ID = "miot.gps.signal.events@1";

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Trip(
            @Schema(title = "En viaje", extensions = @Extension(name = "x-origin", value = "TRIP"))
            Boolean active,
            @Schema(title = "Dos conductores", extensions = @Extension(name = "x-origin", value = "TRIP"))
            @JsonProperty("double_driver") Boolean doubleDriver,
            @Schema(title = "Viaje", extensions = @Extension(name = "x-origin", value = "TRIP"))
            String id,
            @Schema(title = "Código de servicio", extensions = @Extension(name = "x-origin", value = "TRIP"))
            String code,
            @Schema(title = "Tipo de viaje", extensions = @Extension(name = "x-origin", value = "TRIP"))
            String type,
            @Schema(title = "Estado del servicio", extensions = @Extension(name = "x-origin", value = "TRIP"))
            String status,
            @Schema(title = "Tiempo en viaje", extensions = {
                    @Extension(name = "x-unit", value = "min"), @Extension(name = "x-origin", value = "TRIP") })
            @JsonProperty("age_min") Double ageMin,
            @Schema(title = "Atraso sobre la llegada estimada", extensions = {
                    @Extension(name = "x-unit", value = "min"), @Extension(name = "x-origin", value = "TRIP") })
            @JsonProperty("late_min") Double lateMin,
            @Schema(extensions = @Extension(name = "x-origin", value = "TRIP")) Origin origin,
            @Schema(extensions = @Extension(name = "x-origin", value = "TRIP")) Destination destination,
            @Schema(title = "Geocerca actual del viaje", extensions = @Extension(name = "x-origin", value = "TRIP"))
            @JsonProperty("current_zone_id") Integer currentZoneId,
            @Schema(extensions = @Extension(name = "x-origin", value = "TRIP")) Carrier carrier,
            @Schema(title = "Tipo de carga", extensions = @Extension(name = "x-origin", value = "TRIP"))
            @JsonProperty("load_type") String loadType,
            @Schema(title = "Patente del remolque", extensions = @Extension(name = "x-origin", value = "TRIP"))
            @JsonProperty("trailer_plate") String trailerPlate,
            @Schema(extensions = @Extension(name = "x-origin", value = "TRIP")) Driver driver,
            @Schema(title = "Desvío de la llegada prevista", description = "Llegada prevista (ahora más el "
                    + "tiempo que falta según el historial de la ruta) menos la llegada estimada; negativo si va adelantado",
                    extensions = { @Extension(name = "x-unit", value = "min"),
                            @Extension(name = "x-origin", value = "CALCULATED"),
                            @Extension(name = "x-engine", value = "false") })
            @JsonProperty("eta_deviation_min") Double etaDeviationMin) {

        public Trip(Boolean active, Boolean doubleDriver, String id, String code, String type, String status,
                Double ageMin, Double lateMin, Origin origin, Destination destination, Integer currentZoneId,
                Carrier carrier, String loadType, String trailerPlate, Driver driver) {
            this(active, doubleDriver, id, code, type, status, ageMin, lateMin, origin, destination, currentZoneId,
                    carrier, loadType, trailerPlate, driver, null);
        }

        /** A vehicle without a trip in progress. */
        public static Trip none() {
            return new Trip(false, false, null, null, null, null, null, null, null, null, null, null, null, null,
                    null);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Origin(
            @Schema(title = "Geocerca de origen") Integer id,
            @Schema(title = "Origen") String label,
            @Schema(title = "Pasó por el origen") Boolean visited,
            @Schema(title = "Origen interno") Boolean internal) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Destination(
            @Schema(title = "Geocerca de destino") Integer id,
            @Schema(title = "Destino") String label,
            @Schema(title = "Llegó al destino") Boolean visited) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Carrier(
            @Schema(title = "RUT del transportista") String id,
            @Schema(title = "Transportista") String name) {
    }

    /** The trip's driver as the fleet knows them: never their name or national id. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Driver(
            @Schema(title = "Conductor (id de la flota)") String id,
            @Schema(title = "Conductor en la flota") Boolean registered,
            @Schema(title = "Estado del conductor") DriverStatus status,
            @Schema(title = "Licencia vencida") @JsonProperty("license_expired") Boolean licenseExpired) {
    }

    @RegisterForReflection
    public enum DriverStatus {
        @Schema(title = "Activo") ACTIVE,
        @Schema(title = "Desactivado") DEACTIVATED,
        @Schema(title = "Suspendido") SUSPENDED
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Vehicle(
            @Schema(title = "Categoría de peso", extensions = @Extension(name = "x-origin", value = "VEHICLE"))
            @JsonProperty("weight_category") WeightCategory weightCategory,
            @Schema(title = "Peso máximo", extensions = {
                    @Extension(name = "x-unit", value = "kg"), @Extension(name = "x-origin", value = "VEHICLE") })
            @JsonProperty("weight_kg") Double weightKg) {
    }

    @RegisterForReflection
    public enum WeightCategory {
        @Schema(title = "Pesado (más de 3.860 kg o sin dato)") HEAVY,
        @Schema(title = "Liviano (hasta 3.860 kg)") LIGHT
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Road(
            @Schema(title = "Límite de la vía", extensions = {
                    @Extension(name = "x-unit", value = "km/h"), @Extension(name = "x-origin", value = "ROAD_NETWORK") })
            @JsonProperty("maxspeed_osm") Double maxspeedOsm,
            @Schema(title = "Límite propio", extensions = @Extension(name = "x-unit", value = "km/h"))
            @JsonProperty("maxspeed_custom") Double maxspeedCustom) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Geo(
            @Schema(title = "En zona autorizada", description = "Dentro de al menos una zona autorizada",
                    extensions = @Extension(name = "x-origin", value = "ZONES"))
            @JsonProperty("authorized_zone") Boolean authorizedZone,
            @Schema(title = "Zona", extensions = {
                    @Extension(name = "x-type", value = "zone"), @Extension(name = "x-origin", value = "ZONES") })
            String zone,
            @Schema(title = "En zona de riesgo", description = "Dentro de al menos una zona de riesgo",
                    extensions = @Extension(name = "x-origin", value = "ZONES"))
            @JsonProperty("risk_zone") Boolean riskZone,
            @Schema(title = "Fuera de zona autorizada", description = "En ninguna zona, o dentro de una zona no "
                    + "autorizada aunque se cruce con una autorizada",
                    extensions = @Extension(name = "x-origin", value = "ZONES"))
            @JsonProperty("outside_authorized") Boolean outsideAuthorized) {

        public Geo(Boolean authorizedZone, String zone) {
            this(authorizedZone, zone, null, null);
        }
    }

    /**
     * One of the frame's {@code events} as rules read it, under {@value #FRAME_EVENTS}. The type is open text:
     * each GPS provider sends its own codes. A missing value reads as an empty text, so a rule needs no
     * {@code has()}. {@code code} is the producer's code for the event, sent by the device-events endpoint; GPS
     * frames have none.
     */
    @Schema(title = "Eventos del GPS", description = "Los eventos del equipo que trae la trama")
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record FrameEvent(
            @Schema(title = "Tipo de evento") @JsonProperty("event_type") String eventType,
            @Schema(title = "Severidad del evento") String severity,
            @Schema(title = "Descripción del evento") String description,
            @Schema(title = "Hora del evento", extensions = @Extension(name = "x-type", value = "time"))
            String timestamp,
            @Schema(title = "Código del evento") String code) {

        public static final String FRAME_EVENTS = "signal.frame.events";

        /** The event with each missing value as an empty text. */
        public FrameEvent {
            eventType = eventType == null ? "" : eventType;
            severity = severity == null ? "" : severity;
            description = description == null ? "" : description;
            timestamp = timestamp == null ? "" : timestamp;
            code = code == null ? "" : code;
        }

        /** The frame's events as rules read them; empty when the frame has none. */
        public static List<Map<String, Object>> of(Object events) {
            if (!(events instanceof List<?> list)) {
                return List.of();
            }
            return list.stream().filter(Map.class::isInstance).map(e -> of((Map<?, ?>) e).asMap()).toList();
        }

        /** The signal with its frame's events as rules read them; a signal without a frame is kept as it is. */
        @SuppressWarnings("unchecked")
        public static Map<String, Object> withEvents(Map<String, Object> signal) {
            if (!(signal.get("frame") instanceof Map<?, ?> frame)) {
                return signal;
            }
            Map<String, Object> f = new LinkedHashMap<>((Map<String, Object>) frame);
            f.put("events", of(frame.get("events")));
            Map<String, Object> out = new LinkedHashMap<>(signal);
            out.put("frame", f);
            return out;
        }

        static FrameEvent of(Map<?, ?> event) {
            return new FrameEvent(text(event.get("event_type")), text(event.get("severity")),
                    text(event.get("description")), text(event.get("timestamp")), text(event.get("code")));
        }

        public Map<String, Object> asMap() {
            return Map.of("event_type", eventType, "severity", severity, "description", description,
                    "timestamp", timestamp, "code", code);
        }

        private static String text(Object value) {
            return value == null ? null : value.toString();
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    @RegisterForReflection
    public record Derived(
            @Schema(title = "En movimiento", extensions = @Extension(name = "x-origin", value = "CALCULATED"))
            Boolean moving,
            @Schema(title = "Velocidad promedio 5 min", extensions = {
                    @Extension(name = "x-unit", value = "km/h"), @Extension(name = "x-origin", value = "CALCULATED"),
                    @Extension(name = "x-engine", value = "false") })
            @JsonProperty("speed_avg_5m") Double speedAvg5m,
            @Schema(title = "Alimentación del GPS desconectada", description = "La trama trae un evento del equipo "
                    + "de alimentación externa desconectada", extensions = @Extension(name = "x-origin", value = "DEVICE"))
            @JsonProperty("power_disconnected") Boolean powerDisconnected,
            @Schema(title = "Inhibición de señal (jamming)", description = "La trama trae un evento del equipo de "
                    + "inhibición GNSS o GSM", extensions = @Extension(name = "x-origin", value = "DEVICE"))
            Boolean jamming) {

        public Derived(Boolean moving, Double speedAvg5m) {
            this(moving, speedAvg5m, null, null);
        }
    }
}
