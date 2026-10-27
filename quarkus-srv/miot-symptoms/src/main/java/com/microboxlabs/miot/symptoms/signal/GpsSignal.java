package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.AssetTrackingData;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Instant;
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
        @Schema(hidden = true) List<String> clients,
        @Schema(hidden = true) Map<String, Trip> trips,
        Trip trip,
        Vehicle vehicle,
        Road road,
        Geo geo,
        @Schema(title = "Hora local") @JsonProperty("local_hour") Integer localHour,
        Derived derived,
        @Schema(extensions = @Extension(name = "x-origin", value = "DEVICE")) AssetTrackingData frame) {

    public static final String SCHEMA_ID = "miot.gps.signal@1";

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
            @Schema(extensions = @Extension(name = "x-origin", value = "TRIP")) Driver driver) {

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
            @Schema(title = "En zona autorizada", extensions = @Extension(name = "x-origin", value = "ZONES"))
            @JsonProperty("authorized_zone") Boolean authorizedZone,
            @Schema(title = "Zona", extensions = {
                    @Extension(name = "x-type", value = "zone"), @Extension(name = "x-origin", value = "ZONES") })
            String zone) {
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
            @JsonProperty("speed_avg_5m") Double speedAvg5m) {
    }
}
