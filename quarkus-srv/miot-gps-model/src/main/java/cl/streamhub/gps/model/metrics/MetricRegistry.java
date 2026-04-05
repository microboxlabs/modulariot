package cl.streamhub.gps.model.metrics;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Registry of canonical metric definitions.
 * Provides lookup and validation for MetricItem instances.
 *
 * <p>Per milestone.md Section 7:
 * <ul>
 *   <li>§7.1 - Validates key existence, value type, unit, and bounds</li>
 *   <li>§7.2 - Strict mode by default (unknown keys rejected)</li>
 *   <li>§7.3 - Extension keys (x.*) allowed for custom metrics</li>
 * </ul>
 */
public final class MetricRegistry {

    /** Extension key prefix for custom vendor metrics */
    public static final String EXTENSION_PREFIX = "x.";

    private static final String METRIC_PREFIX = "Metric '";

    private static final Map<String, MetricDefinition> DEFINITIONS;

    static {
        Map<String, MetricDefinition> defs = new HashMap<>();

        // === POWERTRAIN METRICS ===
        register(defs, MetricDefinition.builder("engine.rpm")
            .description("Engine speed")
            .valueType(MetricValueType.NUMBER)
            .unit("rpm")
            .minValue(0.0)
            .maxValue(8000.0)
            .category(MetricCategory.POWERTRAIN)
            .build());

        register(defs, MetricDefinition.builder("vehicle.speed")
            .description("Vehicle speed")
            .valueType(MetricValueType.NUMBER)
            .unit("km/h")
            .minValue(0.0)
            .maxValue(300.0)
            .category(MetricCategory.POWERTRAIN)
            .build());

        register(defs, MetricDefinition.builder("engine.load")
            .description("Calculated engine load")
            .valueType(MetricValueType.NUMBER)
            .unit("%")
            .minValue(0.0)
            .maxValue(100.0)
            .category(MetricCategory.POWERTRAIN)
            .build());

        register(defs, MetricDefinition.builder("throttle.position")
            .description("Throttle opening")
            .valueType(MetricValueType.NUMBER)
            .unit("%")
            .minValue(0.0)
            .maxValue(100.0)
            .category(MetricCategory.POWERTRAIN)
            .build());

        register(defs, MetricDefinition.builder("engine.coolant_temp")
            .description("Coolant temperature")
            .valueType(MetricValueType.NUMBER)
            .unit("C")
            .minValue(-40.0)
            .maxValue(150.0)
            .category(MetricCategory.POWERTRAIN)
            .build());

        register(defs, MetricDefinition.builder("engine.intake_air_temp")
            .description("Intake air temperature")
            .valueType(MetricValueType.NUMBER)
            .unit("C")
            .minValue(-40.0)
            .maxValue(80.0)
            .category(MetricCategory.POWERTRAIN)
            .build());

        register(defs, MetricDefinition.builder("engine.runtime")
            .description("Engine run time since start")
            .valueType(MetricValueType.NUMBER)
            .unit("s")
            .minValue(0.0)
            .maxValue(null)
            .category(MetricCategory.POWERTRAIN)
            .build());

        register(defs, MetricDefinition.builder("engine.total_runtime")
            .description("Total engine hours")
            .valueType(MetricValueType.NUMBER)
            .unit("h")
            .minValue(0.0)
            .maxValue(null)
            .category(MetricCategory.POWERTRAIN)
            .build());

        // === FUEL METRICS ===
        register(defs, MetricDefinition.builder("fuel.level")
            .description("Fuel tank level")
            .valueType(MetricValueType.NUMBER)
            .unit("%")
            .minValue(0.0)
            .maxValue(100.0)
            .category(MetricCategory.FUEL)
            .build());

        register(defs, MetricDefinition.builder("fuel.volume")
            .description("Absolute fuel volume in tank")
            .valueType(MetricValueType.NUMBER)
            .unit("L")
            .minValue(0.0)
            .maxValue(1000.0)
            .category(MetricCategory.FUEL)
            .build());

        register(defs, MetricDefinition.builder("fuel.rate")
            .description("Instant fuel consumption")
            .valueType(MetricValueType.NUMBER)
            .unit("L/h")
            .minValue(0.0)
            .maxValue(100.0)
            .category(MetricCategory.FUEL)
            .build());

        register(defs, MetricDefinition.builder("fuel.used")
            .description("Cumulative fuel used")
            .valueType(MetricValueType.NUMBER)
            .unit("L")
            .minValue(0.0)
            .maxValue(null)
            .category(MetricCategory.FUEL)
            .build());

        register(defs, MetricDefinition.builder("battery.voltage")
            .description("ECU/system voltage")
            .valueType(MetricValueType.NUMBER)
            .unit("V")
            .minValue(0.0)
            .maxValue(30.0)
            .category(MetricCategory.ELECTRICAL)
            .build());

        register(defs, MetricDefinition.builder("engine.torque_pct")
            .description("Engine torque utilization")
            .valueType(MetricValueType.NUMBER)
            .unit("%")
            .minValue(0.0)
            .maxValue(100.0)
            .category(MetricCategory.FUEL)
            .build());

        // === MOTION METRICS ===
        register(defs, MetricDefinition.builder("vehicle.odometer")
            .description("Vehicle distance")
            .valueType(MetricValueType.NUMBER)
            .unit("km")
            .minValue(0.0)
            .maxValue(null)
            .category(MetricCategory.MOTION)
            .build());

        register(defs, MetricDefinition.builder("idle.state")
            .description("Engine running, speed ~0")
            .valueType(MetricValueType.BOOLEAN)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.MOTION)
            .build());

        register(defs, MetricDefinition.builder("accelerator.position")
            .description("Accelerator pedal position")
            .valueType(MetricValueType.NUMBER)
            .unit("%")
            .minValue(0.0)
            .maxValue(100.0)
            .category(MetricCategory.MOTION)
            .build());

        register(defs, MetricDefinition.builder("brake.state")
            .description("Brake pedal active")
            .valueType(MetricValueType.BOOLEAN)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.MOTION)
            .build());

        // === DIAGNOSTICS METRICS ===
        register(defs, MetricDefinition.builder("dtc.mil_on")
            .description("Malfunction Indicator Lamp")
            .valueType(MetricValueType.BOOLEAN)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.DIAGNOSTICS)
            .build());

        register(defs, MetricDefinition.builder("dtc.codes")
            .description("Active diagnostic trouble codes")
            .valueType(MetricValueType.ARRAY)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.DIAGNOSTICS)
            .build());

        register(defs, MetricDefinition.builder("dtc.count")
            .description("Number of active DTCs")
            .valueType(MetricValueType.NUMBER)
            .unit("count")
            .minValue(0.0)
            .maxValue(null)
            .category(MetricCategory.DIAGNOSTICS)
            .build());

        register(defs, MetricDefinition.builder("engine.freeze_frame")
            .description("Snapshot at fault time")
            .valueType(MetricValueType.OBJECT)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.DIAGNOSTICS)
            .build());

        // === EMISSIONS METRICS ===
        register(defs, MetricDefinition.builder("fuel.trim.short")
            .description("Short-term fuel trim")
            .valueType(MetricValueType.NUMBER)
            .unit("%")
            .minValue(-100.0)
            .maxValue(100.0)
            .category(MetricCategory.EMISSIONS)
            .build());

        register(defs, MetricDefinition.builder("fuel.trim.long")
            .description("Long-term fuel trim")
            .valueType(MetricValueType.NUMBER)
            .unit("%")
            .minValue(-100.0)
            .maxValue(100.0)
            .category(MetricCategory.EMISSIONS)
            .build());

        register(defs, MetricDefinition.builder("emissions.lambda")
            .description("Air-fuel equivalence ratio")
            .valueType(MetricValueType.NUMBER)
            .unit("ratio")
            .minValue(0.0)
            .maxValue(2.0)
            .category(MetricCategory.EMISSIONS)
            .build());

        register(defs, MetricDefinition.builder("catalyst.temp")
            .description("Catalyst temperature")
            .valueType(MetricValueType.NUMBER)
            .unit("C")
            .minValue(0.0)
            .maxValue(1000.0)
            .category(MetricCategory.EMISSIONS)
            .build());

        // === ELECTRICAL METRICS ===
        register(defs, MetricDefinition.builder("battery.current")
            .description("Battery current")
            .valueType(MetricValueType.NUMBER)
            .unit("A")
            .minValue(-100.0)
            .maxValue(100.0)
            .category(MetricCategory.ELECTRICAL)
            .build());

        register(defs, MetricDefinition.builder("pto.state")
            .description("Power take-off active")
            .valueType(MetricValueType.BOOLEAN)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.ELECTRICAL)
            .build());

        register(defs, MetricDefinition.builder("engine.fan.state")
            .description("Cooling fan active")
            .valueType(MetricValueType.BOOLEAN)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.ELECTRICAL)
            .build());

        // === IDENTITY METRICS ===
        register(defs, MetricDefinition.builder("vehicle.vin")
            .description("Vehicle identification number")
            .valueType(MetricValueType.STRING)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.IDENTITY)
            .build());

        register(defs, MetricDefinition.builder("vehicle.protocol")
            .description("Bus/protocol used")
            .valueType(MetricValueType.STRING)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.IDENTITY)
            .build());

        register(defs, MetricDefinition.builder("vehicle.ecu")
            .description("ECU source")
            .valueType(MetricValueType.STRING)
            .unit(null)
            .minValue(null)
            .maxValue(null)
            .category(MetricCategory.IDENTITY)
            .build());

        DEFINITIONS = Collections.unmodifiableMap(defs);
    }

    private static void register(Map<String, MetricDefinition> map, MetricDefinition def) {
        map.put(def.getKey(), def);
    }

    private MetricRegistry() {
        // Prevent instantiation
    }

    /**
     * Checks if a metric key is registered in the canonical registry.
     *
     * @param key the metric key to check
     * @return true if the key is a known canonical metric
     */
    public static boolean isKnownMetric(String key) {
        return key != null && DEFINITIONS.containsKey(key);
    }

    /**
     * Checks if a key is an extension key (prefixed with "x.").
     * Extension keys allow vendor-specific custom metrics.
     *
     * @param key the metric key to check
     * @return true if the key starts with the extension prefix
     */
    public static boolean isExtensionKey(String key) {
        return key != null && key.startsWith(EXTENSION_PREFIX);
    }

    /**
     * Looks up the definition for a canonical metric key.
     *
     * @param key the metric key to look up
     * @return Optional containing the definition, or empty if not found
     */
    public static Optional<MetricDefinition> lookup(String key) {
        return Optional.ofNullable(DEFINITIONS.get(key));
    }

    /**
     * Returns all canonical metric keys.
     *
     * @return unmodifiable set of all registered metric keys
     */
    public static Set<String> getAllKeys() {
        return DEFINITIONS.keySet();
    }

    /**
     * Returns all metric keys belonging to a specific category.
     *
     * @param category the category to filter by (use MetricCategory constants)
     * @return set of metric keys in the specified category
     */
    public static Set<String> getKeysByCategory(String category) {
        return DEFINITIONS.values().stream()
            .filter(def -> category.equals(def.getCategory()))
            .map(MetricDefinition::getKey)
            .collect(Collectors.toSet());
    }

    /**
     * Validates a MetricItem against the registry.
     *
     * <p>Validation checks (per milestone.md §7.1):
     * <ol>
     *   <li>Key exists in registry or is an extension key (x.*)</li>
     *   <li>Value type matches expected type</li>
     *   <li>Unit matches canonical unit (for numeric types that require units)</li>
     *   <li>Numeric value is within defined bounds</li>
     * </ol>
     *
     * @param item the MetricItem to validate
     * @return MetricValidationResult indicating success or failure with details
     */
    public static MetricValidationResult validate(MetricItem item) {
        if (item == null) {
            return MetricValidationResult.error(MetricValidationResult.UNKNOWN_KEY,
                "MetricItem cannot be null");
        }

        String key = item.getK();

        // 1. Check if key is known or is an extension key
        if (!isKnownMetric(key) && !isExtensionKey(key)) {
            return MetricValidationResult.error(MetricValidationResult.UNKNOWN_KEY,
                "Metric key '" + key + "' is not recognized");
        }

        // Extension keys bypass further validation (handled at API layer)
        if (isExtensionKey(key)) {
            return MetricValidationResult.ok();
        }

        // Get definition for canonical key
        MetricDefinition def = DEFINITIONS.get(key);
        Object value = item.getV();

        // 2. Validate value type
        if (!def.isValidValueType(value)) {
            return MetricValidationResult.error(MetricValidationResult.TYPE_MISMATCH,
                METRIC_PREFIX + key + "' expects type " + def.getValueType() +
                " but got " + (value != null ? value.getClass().getSimpleName() : "null"));
        }

        // 3. Validate unit (for numeric types that require units)
        if (def.requiresUnit()) {
            String expectedUnit = def.getUnit();
            String actualUnit = item.getU();
            if (actualUnit == null || !expectedUnit.equals(actualUnit)) {
                return MetricValidationResult.error(MetricValidationResult.UNIT_MISMATCH,
                    METRIC_PREFIX + key + "' requires unit '" + expectedUnit +
                    "' but got '" + actualUnit + "'");
            }
        }

        // 4. Validate bounds (for numeric values)
        if (!def.isInBounds(value)) {
            String boundsDesc = formatBounds(def.getMinValue(), def.getMaxValue());
            return MetricValidationResult.error(MetricValidationResult.OUT_OF_BOUNDS,
                METRIC_PREFIX + key + "' value " + value + " is out of bounds " + boundsDesc);
        }

        return MetricValidationResult.ok();
    }

    private static String formatBounds(Double min, Double max) {
        if (min != null && max != null) {
            return "[" + min + ", " + max + "]";
        } else if (min != null) {
            return "[" + min + ", unbounded]";
        } else if (max != null) {
            return "[unbounded, " + max + "]";
        }
        return "[unbounded]";
    }
}
