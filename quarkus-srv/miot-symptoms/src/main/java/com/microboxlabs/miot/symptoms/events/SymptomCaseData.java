package com.microboxlabs.miot.symptoms.events;

import java.time.Instant;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** The data of every {@code symptom.case.*} event. A field that does not apply to the event's type is null. */
@Schema(title = "Caso de síntoma")
public record SymptomCaseData(
        @Schema(title = "Caso", description = "The case's symptom id in the Control Tower") long symptomId,
        @Schema(title = "Síntoma", description = "The symptom definition") UUID definitionId,
        @Schema(title = "Versión", description = "The symptom version that raised the case") String version,
        @Schema(title = "Clave del síntoma", description = "The symptom's key, such as panic-button")
        String symptomKey,
        @Schema(title = "Síntoma (nombre)", description = "The symptom's name") String symptomName,
        @Schema(title = "Nivel", description = "The case's ICU level, 1 to 4") int level,
        @Schema(title = "Nivel anterior", description = "The level before this change; 0 when the case opens")
        int previousLevel,
        @Schema(title = "Vehículo", description = "The asset id") String assetId,
        @Schema(title = "Viaje", description = "The trip of the signal, when it had one") String tripId,
        @Schema(title = "Conductor (id)", description = "The trip's driver in the driver registry; null on an "
                + "operator's close and on sla_expired") String driverId,
        @Schema(title = "Medida", description = "The measure on the signal; null on an operator's close")
        Double measure,
        @Schema(title = "Latitud") Double latitude,
        @Schema(title = "Longitud") Double longitude,
        @Schema(title = "Velocidad", description = "Speed in km/h") Double speedKmh,
        @Schema(title = "Cerrado por", description = "The operator who closed the case; null when the rules closed it")
        String closedBy,
        @Schema(title = "SLA (min)", description = "The level's SLA in minutes; on sla_expired only")
        Integer slaMinutes,
        @Schema(title = "En el nivel desde", description = "When the case reached its level; on sla_expired only")
        Instant levelSince,
        @Schema(title = "Volvió la señal", description = "When the vehicle's signal returned; on signal_returned only")
        Instant signalReturnedAt,
        @Schema(title = "Volvió con relleno", description = "Frames from inside the silence arrived after it; on "
                + "signal_returned only")
        Boolean backfill) {
}
