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

    @Test
    void refusesUnknownStepsStepsOutOfOrderAndACompletingStepOutsideTheCycle() {
        assertThrows(IllegalArgumentException.class, () -> DeliveryCycle.of(Map.of("deliverySteps", "invoiced")));
        assertThrows(IllegalArgumentException.class,
                () -> DeliveryCycle.of(Map.of("deliverySteps", "settled,delivered")));
        assertThrows(IllegalArgumentException.class,
                () -> DeliveryCycle.of(Map.of("deliverySteps", "delivered,delivered")));
        assertThrows(IllegalArgumentException.class, () -> DeliveryCycle.of(Map.of("deliverySteps", " ")));
        assertThrows(IllegalArgumentException.class,
                () -> DeliveryCycle.of(Map.of("deliverySteps", "delivered", "deliveryCompletesTrip", "settled")));
        assertThrows(IllegalArgumentException.class,
                () -> DeliveryCycle.of(Map.of("deliveryProofRequired", "yes")));
    }
}
