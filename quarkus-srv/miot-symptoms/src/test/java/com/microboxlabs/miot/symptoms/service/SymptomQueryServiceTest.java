package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.symptoms.dto.SymptomFilter;
import io.smallrye.mutiny.Uni;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SymptomQueryServiceTest {

    private final SymptomQueryService service = new SymptomQueryService(
            (sql, params) -> Uni.createFrom().failure(new AssertionError("no query expected")),
            new SymptomsTenantResolver(Optional.empty()));

    @Test
    void underTreatmentWinsOverTheIcuCode() {
        assertEquals("Under Treatment", SymptomQueryService.icuCondition(4, 2));
        assertEquals("Code Black", SymptomQueryService.icuCondition(4, 0));
        assertEquals("Critical condition", SymptomQueryService.icuCondition(3, 0));
        assertEquals("Compromised condition", SymptomQueryService.icuCondition(2, 0));
        assertEquals("Under Observation", SymptomQueryService.icuCondition(1, 0));
        assertNull(SymptomQueryService.icuCondition(null, 0));
        assertNull(SymptomQueryService.icuCondition(9, 0));
    }

    @Test
    void pagingAndDateRangeAreValidatedBeforeAnyQuery() {
        SymptomFilter none = new SymptomFilter(null, null, null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.list("t", none, 0, 10));
        assertThrows(IllegalArgumentException.class, () -> service.list("t", none, 1, 0));
        assertThrows(IllegalArgumentException.class,
                () -> service.list("t", none, 1, SymptomQueryService.MAX_PAGE_SIZE + 1));

        OffsetDateTime now = OffsetDateTime.now();
        SymptomFilter inverted = new SymptomFilter(null, null, null, null, null, now, now.minusHours(1));
        assertThrows(IllegalArgumentException.class, () -> service.list("t", inverted, 1, 10));
    }
}
