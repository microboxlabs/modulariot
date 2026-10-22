package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.AssetTrackingData;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Instant;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * {@code miot.gps.signal@1}: one GPS frame as symptom rules read it, under the
 * CEL root {@code signal}. {@code frame} is the frame as the device sent it;
 * the other parts are what the signal builder adds from the trip, the vehicle,
 * the road network and the zones. A part the builder does not know is null.
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
        Trip trip,
        Vehicle vehicle,
        Gps gps,
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
            String id) {
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
    public record Gps(
            @Schema(title = "Velocidad", extensions = {
                    @Extension(name = "x-unit", value = "km/h"), @Extension(name = "x-origin", value = "DEVICE") })
            @JsonProperty("speed_kmh") Double speedKmh,
            @Schema(title = "Motor encendido", extensions = @Extension(name = "x-origin", value = "DEVICE"))
            @JsonProperty("engine_on") Boolean engineOn,
            @Schema(title = "En movimiento", extensions = @Extension(name = "x-origin", value = "CALCULATED"))
            Boolean moving) {
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
            @Schema(title = "Velocidad promedio 5 min", extensions = {
                    @Extension(name = "x-unit", value = "km/h"), @Extension(name = "x-origin", value = "CALCULATED"),
                    @Extension(name = "x-engine", value = "false") })
            @JsonProperty("speed_avg_5m") Double speedAvg5m) {
    }
}
