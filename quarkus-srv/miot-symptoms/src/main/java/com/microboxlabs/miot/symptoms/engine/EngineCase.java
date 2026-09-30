package com.microboxlabs.miot.symptoms.engine;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One case (a symptom row) as the engine recorded it.
 *
 * @param value the accumulated measure, such as km/h over the limit
 */
public record EngineCase(
        long id,
        String symptomName,
        int icu,
        String tripId,
        OffsetDateTime firstSignalAt,
        OffsetDateTime lastSignalAt,
        BigDecimal value,
        boolean active,
        boolean excluded) {
}
