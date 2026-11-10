package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.FieldOrigin;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Finding;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Severity;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

public class OperatorWhenSpecTest {

    static final String NOT_OTR_OTE = "signal.trip.type != \"otr\" && signal.trip.type != \"ote\"";
    private static final String SECTION = "levels.3.response.operatorWhen";
    private final ObjectMapper mapper = new ObjectMapper();

    /** The test source with the trip's type, as the GPS signal has it. */
    public static DataSource source() {
        DataSource s = Specs.gpsSignal();
        List<SourceField> fields = new ArrayList<>(s.fields());
        fields.add(new SourceField("signal.trip.type", "Tipo de viaje", "text", null, FieldOrigin.TRIP, true));
        return new DataSource(s.id(), s.tenantCode(), s.key(), s.name(), s.kind(), s.root(), s.cadence(), fields,
                s.samples());
    }

    /** The speeding spec with {@code when} on level 3's response. */
    static SymptomSpec withLevelThree(SymptomSpec base, String when) {
        List<Level> levels = new ArrayList<>(base.levels());
        Level three = levels.get(2);
        levels.set(2, new Level(three.icu(), three.applies(), three.when(), three.response().withOperatorWhen(when),
                three.ignore()));
        return Specs.withLevels(base, levels);
    }

    @Test
    void anOlderResponseWithoutTheFieldAlwaysAsksForTheOperator() throws Exception {
        SymptomSpec.Response r = mapper.readValue("""
                {"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}
                """, SymptomSpec.Response.class);

        assertTrue(r.operator());
        assertNull(r.operatorWhen());
        assertFalse(mapper.writeValueAsString(r).contains("operatorWhen"), "an older spec is written as before");
    }

    @Test
    void theConditionIsReadAndWrittenAndABlankOneIsNone() throws Exception {
        SymptomSpec.Response r = mapper.readValue("""
                {"operator":true,"slaMinutes":15,"operatorWhen":"signal.trip.type != \\"otr\\""}
                """, SymptomSpec.Response.class);
        assertEquals("signal.trip.type != \"otr\"", r.operatorWhen());
        assertEquals(r, mapper.readValue(mapper.writeValueAsString(r), SymptomSpec.Response.class));

        assertNull(mapper.readValue("{\"operator\":true,\"operatorWhen\":\"  \"}", SymptomSpec.Response.class)
                .operatorWhen());
    }

    @Test
    void aValidConditionIsPublishable() {
        SymptomSpec spec = withLevelThree(Specs.speeding(), NOT_OTR_OTE);

        assertTrue(SpecValidator.validate(spec, source()).publishable());
    }

    @Test
    void theConditionIsCheckedLikeTheOtherConditions() {
        List<Finding> unknownField = SpecValidator.validate(withLevelThree(Specs.speeding(),
                "signal.trip.kind == \"otr\""), source()).findings();
        assertTrue(unknownField.stream().anyMatch(f -> f.section().equals(SECTION)
                && f.severity() == Severity.ERROR), unknownField.toString());

        List<Finding> notACondition = SpecValidator.validate(withLevelThree(Specs.speeding(), "signal.trip.type"),
                source()).findings();
        assertTrue(notACondition.stream().anyMatch(f -> f.section().equals(SECTION)
                && f.severity() == Severity.ERROR), notACondition.toString());

        List<Finding> wrongType = SpecValidator.validate(withLevelThree(Specs.speeding(),
                "signal.trip.type > 3"), source()).findings();
        assertTrue(wrongType.stream().anyMatch(f -> f.section().equals(SECTION)
                && f.severity() == Severity.ERROR), wrongType.toString());
    }

    @Test
    void anOperatorWithAConditionStillNeedsAnSla() {
        SymptomSpec spec = Specs.withLevels(Specs.speeding(), List.of(
                new Level(1, false, null, null), new Level(2, false, null, null), new Level(3, false, null, null),
                new Level(4, true, "measure >= 21", Specs.response(true, null).withOperatorWhen(NOT_OTR_OTE))));

        List<Finding> findings = SpecValidator.validate(spec, source()).findings();
        assertEquals(List.of("operatorNeedsSla"), findings.stream().map(Finding::code).toList());
    }

    @Test
    void aConditionWithoutTheOperatorIsNotChecked() {
        List<Level> levels = new ArrayList<>(Specs.speeding().levels());
        levels.set(0, new Level(1, true, levels.get(0).when(),
                Specs.response(false, null).withOperatorWhen("not a rule (")));

        assertTrue(SpecValidator.validate(Specs.withLevels(Specs.speeding(), levels), source()).publishable());
    }
}
