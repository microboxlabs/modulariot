package com.microboxlabs.miot.symptoms.signal;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * {@code trip_check}: a check of a vehicle on a trip, under the CEL root {@code check}. The lost-signal detector
 * writes one when the vehicle's deadline expires, then every minute while it stays silent, and one when its
 * signal returns. {@code trip} is the trip as the vehicle's newest signal carried it.
 *
 * <p>The rule editor's fields for the source are read from these annotations ({@link SignalFields}), as for
 * {@link GpsSignal}.
 */
@Schema(title = "Revisión periódica del viaje", extensions = {
        @Extension(name = "x-cadence", value = "Cuando vence el plazo de señal del vehículo, cada minuto mientras sigue sin señal y cuando vuelve") })
@JsonInclude(JsonInclude.Include.NON_NULL)
@RegisterForReflection
public record TripCheck(
        @Schema(title = "Minutos conduciendo seguido", extensions = {
                @Extension(name = "x-unit", value = "min"), @Extension(name = "x-origin", value = "CALCULATED"),
                @Extension(name = "x-engine", value = "false") })
        @JsonProperty("driving_minutes") Double drivingMinutes,
        @Schema(title = "Minutos de descanso", extensions = {
                @Extension(name = "x-unit", value = "min"), @Extension(name = "x-origin", value = "CALCULATED"),
                @Extension(name = "x-engine", value = "false") })
        @JsonProperty("resting_minutes") Double restingMinutes,
        @Schema(title = "Minutos sin señal", extensions = {
                @Extension(name = "x-unit", value = "min"), @Extension(name = "x-origin", value = "CALCULATED") })
        @JsonProperty("signal_lost_minutes") Double signalLostMinutes,
        @Schema(extensions = @Extension(name = "x-origin", value = "TRIP")) GpsSignal.Trip trip,
        @Schema(extensions = @Extension(name = "x-origin", value = "CALCULATED")) Loss loss) {

    public static final String KEY = "trip_check";
    public static final String ROOT = "check";

    /** The silence and what the detector knows about it. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @RegisterForReflection
    public record Loss(
            @Schema(title = "Segundos sin señal", description = "Since the newest frame was taken",
                    extensions = @Extension(name = "x-unit", value = "s"))
            @JsonProperty("silence_s") Double silenceS,
            @Schema(title = "Silencio esperado", description = "The vehicle's expected gap plus its sender's delivery delay",
                    extensions = @Extension(name = "x-unit", value = "s"))
            @JsonProperty("expected_s") Double expectedS,
            @Schema(title = "Silencio sobre lo esperado", description = "silence_s / expected_s")
            Double ratio,
            Last last,
            @Schema(title = "Emisor", description = "The client that sends the vehicle's frames") String sender,
            @Schema(title = "Volvió la señal") Boolean returned,
            @Schema(title = "Volvió con relleno", description = "Frames from inside the silence arrived after it")
            Boolean backfill,
            @Schema(title = "Zona de baja cobertura", description = "The shadow map says frames arrive delayed in "
                    + "the last position's cell")
            @JsonProperty("low_coverage_zone") Boolean lowCoverageZone,
            @Schema(title = "Pérdida en grupo", description = "Many of the sender's vehicles are lost at once, "
                    + "against its usual count")
            @JsonProperty("cohort_outage") Boolean cohortOutage,
            @Schema(title = "Unidades cercanas reportando", description = "Vehicles that reported in the last "
                    + "10 min within 10 km of the last position")
            @JsonProperty("nearby_reporting") Double nearbyReporting) {
    }

    /** The newest frame before the silence. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @RegisterForReflection
    public record Last(
            @Schema(hidden = true) String at,
            @Schema(title = "Latitud de la última señal") Double lat,
            @Schema(title = "Longitud de la última señal") Double lon,
            @Schema(title = "Velocidad de la última señal", extensions = @Extension(name = "x-unit", value = "km/h"))
            Double speed,
            @Schema(title = "Motor encendido en la última señal") Boolean engine) {
    }

    public static String name() {
        return TripCheck.class.getAnnotation(Schema.class).title();
    }

    /** Two checks with the source's whole shape: a vehicle lost at speed, and one whose signal came back. */
    public static List<Map<String, Object>> samples() {
        GpsSignal.Trip trip = new GpsSignal.Trip(true, false, "T-1", null, "v", "in_transit", 240.0, -15.0, null,
                null, null, null, null, null, null);
        TripCheck lost = new TripCheck(null, null, 6.0, trip, new Loss(360.0, 120.0, 3.0,
                new Last("2026-01-01T12:00:00Z", -23.6, -70.4, 82.0, true), "sender-1", false, false, false, false, 4.0));
        TripCheck back = new TripCheck(null, null, 0.5, trip, new Loss(30.0, 120.0, 0.25,
                new Last("2026-01-01T12:40:00Z", -23.7, -70.3, 60.0, true), "sender-1", true, true, true, false, 2.0));
        return List.of(sample(lost), sample(back));
    }

    private static Map<String, Object> sample(TripCheck c) {
        return Map.of(ROOT, SignalStream.JSON.convertValue(c, Map.class));
    }
}
