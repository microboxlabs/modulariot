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
        @Schema(title = "Minutos de jornada sin descanso largo", description = "Minutos de viaje desde el último "
                + "descanso de 8 h del conductor, o desde que empezó el viaje", extensions = {
                @Extension(name = "x-unit", value = "min"), @Extension(name = "x-origin", value = "CALCULATED"),
                @Extension(name = "x-engine", value = "false") })
        @JsonProperty("duty_minutes") Double dutyMinutes,
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
            @Schema(title = "Segundos sin señal", description = "Desde que se tomó la última trama",
                    extensions = @Extension(name = "x-unit", value = "s"))
            @JsonProperty("silence_s") Double silenceS,
            @Schema(title = "Silencio esperado", description = "Intervalo normal del vehículo más la demora de entrega de su emisor",
                    extensions = @Extension(name = "x-unit", value = "s"))
            @JsonProperty("expected_s") Double expectedS,
            @Schema(title = "Silencio sobre lo esperado", description = "Segundos sin señal divididos por el silencio esperado")
            Double ratio,
            Last last,
            @Schema(title = "Emisor", description = "El cliente que envía las tramas del vehículo") String sender,
            @Schema(title = "Volvió la señal") Boolean returned,
            @Schema(title = "Volvió con relleno", description = "Llegaron después tramas tomadas durante el silencio")
            Boolean backfill,
            @Schema(title = "Zona de baja cobertura", description = "El mapa de sombra dice que en la celda de la "
                    + "última posición las tramas llegan tarde o se pierden")
            @JsonProperty("low_coverage_zone") Boolean lowCoverageZone,
            @Schema(title = "Proporción sin cobertura", description = "Parte de tramas atrasadas o perdidas en la "
                    + "celda, del emisor o de los demás; vacío si nadie la ha medido")
            @JsonProperty("coverage_share") Double coverageShare,
            @Schema(title = "Fuente de cobertura", description = "Quién midió la celda: sender (el emisor), consensus (los demás) o none",
                    enumeration = {"sender", "consensus", "none"})
            @JsonProperty("coverage_source") String coverageSource,
            @Schema(title = "Pérdida en grupo", description = "Muchos vehículos del emisor sin señal a la vez, "
                    + "frente a lo habitual")
            @JsonProperty("cohort_outage") Boolean cohortOutage,
            @Schema(title = "Unidades cercanas reportando", description = "Vehículos que reportaron en los últimos "
                    + "10 min a menos de 10 km de la última posición")
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

    /**
     * Two checks with the source's whole shape: a vehicle lost at speed, and one whose signal came back. They keep
     * synthetic driving, resting and duty minutes so the continuous-driving and resting templates still preview in
     * the editor.
     */
    public static List<Map<String, Object>> samples() {
        GpsSignal.Trip trip = new GpsSignal.Trip(true, false, "T-1", null, "v", "in_transit", 240.0, -15.0, null,
                null, null, null, null, null, null);
        TripCheck lost = new TripCheck(312.0, 0.0, 990.0, 6.0, trip, new Loss(360.0, 120.0, 3.0,
                new Last("2026-01-01T12:00:00Z", -23.6, -70.4, 82.0, true), "sender-1", false, false, false, 0.12, "sender", false, 4.0));
        TripCheck back = new TripCheck(40.0, 0.0, 120.0, 0.5, trip, new Loss(30.0, 120.0, 0.25,
                new Last("2026-01-01T12:40:00Z", -23.7, -70.3, 60.0, true), "sender-1", true, true, false, null, "none", false, 0.0));
        return List.of(sample(lost), sample(back));
    }

    private static Map<String, Object> sample(TripCheck c) {
        return Map.of(ROOT, SignalStream.JSON.convertValue(c, Map.class));
    }
}
