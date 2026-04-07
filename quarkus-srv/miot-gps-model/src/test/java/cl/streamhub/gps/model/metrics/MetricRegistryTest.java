package cl.streamhub.gps.model.metrics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class MetricRegistryTest {

    @Test
    void validateDefaultsCanonicalUnitWhenMissing() {
        MetricItem item = new MetricItem();
        item.setK("vehicle.odometer");
        item.setV(12345);

        MetricValidationResult result = MetricRegistry.validate(item);

        assertTrue(result.isValid());
        assertEquals("km", item.getU());
    }

    @Test
    void validateStillRejectsWrongUnit() {
        MetricItem item = new MetricItem();
        item.setK("battery.voltage");
        item.setV(13.9);
        item.setU("mV");

        MetricValidationResult result = MetricRegistry.validate(item);

        assertEquals(MetricValidationResult.UNIT_MISMATCH, result.getErrorCode());
    }
}
