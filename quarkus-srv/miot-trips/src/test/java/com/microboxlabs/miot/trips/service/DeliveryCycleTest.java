package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.stream.Stream;

class DeliveryCycleTest {

    @Test
    void withoutParametersEveryStepIsUsedAndNothingCompletesTheTrip() {
        DeliveryCycle c = DeliveryCycle.of(Map.of("speedLimit", 90));

        assertEquals(List.of("delivered", "accepted", "settled"), c.steps());
        assertNull(c.completesTrip());
        assertTrue(c.proofRequired());
        assertFalse(c.confirmOnProof());
        assertEquals("delivered", c.before("accepted"));
        assertNull(c.before("delivered"));
    }

    @Test
    void aCustomerMaySkipStepsAndNameTheOneThatCompletesTheTrip() {
        DeliveryCycle c = DeliveryCycle.of(Map.of("deliverySteps", "delivered, settled",
                "deliveryCompletesTrip", "settled", "deliveryProofRequired", false, "deliveryConfirmOnProof", true));

        assertEquals(List.of("delivered", "settled"), c.steps());
        assertEquals("delivered", c.before("settled"));
        assertEquals("settled", c.completesTrip());
        assertFalse(c.proofRequired());
        assertTrue(c.confirmOnProof());
    }

    @ParameterizedTest
    @ValueSource(strings = {",", ", ,", " , , "})
    void refusesAListWithNoSteps(String steps) {
        Map<String, Object> params = Map.of("deliverySteps", steps);
        assertThrows(IllegalArgumentException.class, () -> DeliveryCycle.of(params));
    }

    @ParameterizedTest
    @MethodSource("invalidCycles")
    void refusesUnknownStepsStepsOutOfOrderAndACompletingStepOutsideTheCycle(Map<String, Object> params) {
        assertThrows(IllegalArgumentException.class, () -> DeliveryCycle.of(params));
    }

    private static Stream<Map<String, Object>> invalidCycles() {
        return Stream.of(Map.of("deliverySteps", "invoiced"), Map.of("deliverySteps", "settled,delivered"),
                Map.of("deliverySteps", "delivered,delivered"), Map.of("deliverySteps", " "),
                Map.of("deliverySteps", "delivered", "deliveryCompletesTrip", "settled"),
                Map.of("deliveryProofRequired", "yes"));
    }
}
