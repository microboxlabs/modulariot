package cl.streamhub.gps.model.metrics;

import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * Metrics envelope following miot.metrics@1.0 specification.
 * Provides a standardized container for telemetry metrics from vehicle and IoT devices.
 */
@Schema(
    description = "Metrics envelope following miot.metrics@1.0 specification. " +
        "Provides a standardized container for telemetry metrics from OBD2, J1939, CAN, " +
        "and other vehicle/IoT data sources."
)
@RegisterForReflection
public class MetricsEnvelope {

    /** Pattern for valid schema identifiers */
    public static final String SCHEMA_PATTERN = "^miot\\.metrics@\\d+\\.\\d+$";

    @Schema(
        description = "Schema identifier for the metrics envelope format",
        example = "miot.metrics@1.0",
        pattern = SCHEMA_PATTERN,
        required = true,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)}
    )
    @NotBlank(message = "Schema identifier is required")
    @Pattern(regexp = SCHEMA_PATTERN, message = "Schema must match format 'miot.metrics@X.Y'")
    private String schema;

    @Schema(
        description = "Array of metric items (at least one required)",
        required = true,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)}
    )
    @NotEmpty(message = "At least one metric item is required")
    @Valid
    private List<MetricItem> items;

    @Schema(
        description = "Device sequence number for ordering and deduplication",
        example = "12345",
        minimum = "0",
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)}
    )
    private Long seq;

    @Schema(
        description = "Device clock timestamp in RFC3339 format",
        example = "2026-01-20T14:12:00Z",
        extensions = {@Extension(name = "x-order", value = "4", parseValue = true)}
    )
    @JsonProperty("device_ts")
    private ZonedDateTime deviceTs;

    @Schema(
        description = "Opaque device capabilities metadata",
        extensions = {@Extension(name = "x-order", value = "5", parseValue = true)}
    )
    private Map<String, Object> capabilities;

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        this.schema = schema;
    }

    public List<MetricItem> getItems() {
        return items;
    }

    public void setItems(List<MetricItem> items) {
        this.items = items;
    }

    public Long getSeq() {
        return seq;
    }

    public void setSeq(Long seq) {
        this.seq = seq;
    }

    public ZonedDateTime getDeviceTs() {
        return deviceTs;
    }

    public void setDeviceTs(ZonedDateTime deviceTs) {
        this.deviceTs = deviceTs;
    }

    public Map<String, Object> getCapabilities() {
        return capabilities;
    }

    public void setCapabilities(Map<String, Object> capabilities) {
        this.capabilities = capabilities;
    }
}
