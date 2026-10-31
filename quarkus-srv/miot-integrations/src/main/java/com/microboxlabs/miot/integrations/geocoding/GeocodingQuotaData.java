package com.microboxlabs.miot.integrations.geocoding;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** The data of a {@code geocoding.quota.*} event. */
@Schema(title = "Cupo de geocoding")
public record GeocodingQuotaData(
        @Schema(title = "Organización", description = "The organization slug") String organization,
        @Schema(title = "Mes", description = "The month, as 2026-10") String month,
        @Schema(title = "Usadas", description = "Provider calls this month") long used,
        @Schema(title = "Cupo", description = "Provider calls included in the month") int quota,
        @Schema(title = "Porcentaje", description = "Share of the quota used, rounded down") int usedPct,
        @Schema(title = "Al agotarse", description = "review or overage") String onExhausted) {
}
