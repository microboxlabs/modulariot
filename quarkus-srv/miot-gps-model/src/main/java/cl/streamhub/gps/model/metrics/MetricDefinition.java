package cl.streamhub.gps.model.metrics;

import java.util.Collection;
import java.util.Map;

/**
 * Immutable definition of a canonical metric.
 * Contains metadata for validation: key, type, unit, bounds, and category.
 */
public final class MetricDefinition {

    private final String key;
    private final String description;
    private final String valueType;
    private final String unit;
    private final Double minValue;
    private final Double maxValue;
    private final String category;

    private MetricDefinition(Builder builder) {
        this.key = builder.key;
        this.description = builder.description;
        this.valueType = builder.valueType;
        this.unit = builder.unit;
        this.minValue = builder.minValue;
        this.maxValue = builder.maxValue;
        this.category = builder.category;
    }

    public String getKey() {
        return key;
    }

    public String getDescription() {
        return description;
    }

    public String getValueType() {
        return valueType;
    }

    public String getUnit() {
        return unit;
    }

    public Double getMinValue() {
        return minValue;
    }

    public Double getMaxValue() {
        return maxValue;
    }

    public String getCategory() {
        return category;
    }

    /**
     * Returns true if this metric requires a unit to be specified.
     * Numeric metrics with a defined unit require the unit field.
     */
    public boolean requiresUnit() {
        return MetricValueType.NUMBER.equals(valueType) && unit != null;
    }

    /**
     * Validates if the given value matches the expected type.
     *
     * @param value the value to validate
     * @return true if the value type matches, false otherwise
     */
    public boolean isValidValueType(Object value) {
        if (value == null) {
            return false;
        }

        switch (valueType) {
            case MetricValueType.NUMBER:
                return value instanceof Number;
            case MetricValueType.BOOLEAN:
                return value instanceof Boolean;
            case MetricValueType.STRING:
                return value instanceof String;
            case MetricValueType.ARRAY:
                return value instanceof Collection || value.getClass().isArray();
            case MetricValueType.OBJECT:
                return value instanceof Map;
            default:
                return false;
        }
    }

    /**
     * Checks if the given numeric value is within the defined bounds.
     * Returns true if no bounds are defined or if the value is not numeric.
     *
     * @param value the value to check
     * @return true if in bounds or bounds not applicable, false if out of bounds
     */
    public boolean isInBounds(Object value) {
        if (!(value instanceof Number)) {
            return true; // Bounds only apply to numeric values
        }

        double numValue = ((Number) value).doubleValue();

        if (minValue != null && numValue < minValue) {
            return false;
        }
        if (maxValue != null && numValue > maxValue) {
            return false;
        }

        return true;
    }

    /**
     * Creates a new builder for MetricDefinition.
     */
    public static Builder builder(String key) {
        return new Builder(key);
    }

    /**
     * Builder for MetricDefinition.
     */
    public static final class Builder {
        private final String key;
        private String description;
        private String valueType;
        private String unit;
        private Double minValue;
        private Double maxValue;
        private String category;

        private Builder(String key) {
            this.key = key;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder valueType(String valueType) {
            this.valueType = valueType;
            return this;
        }

        public Builder unit(String unit) {
            this.unit = unit;
            return this;
        }

        public Builder minValue(Double minValue) {
            this.minValue = minValue;
            return this;
        }

        public Builder maxValue(Double maxValue) {
            this.maxValue = maxValue;
            return this;
        }

        public Builder category(String category) {
            this.category = category;
            return this;
        }

        public MetricDefinition build() {
            return new MetricDefinition(this);
        }
    }
}
