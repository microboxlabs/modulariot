package cl.streamhub.gps.model.metrics;

import io.quarkus.runtime.annotations.RegisterForReflection;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import java.time.ZonedDateTime;
import java.util.Map;

/**
 * Individual metric item within the metrics envelope.
 * Represents a single telemetry measurement with its metadata.
 */
@Schema(
    description = "Individual metric item within the metrics envelope. " +
        "Represents a single telemetry measurement with its metadata."
)
@RegisterForReflection
public class MetricItem {

    /** Pattern for valid metric keys: lowercase segments separated by dots (2-6 segments) */
    public static final String KEY_PATTERN = "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*){1,5}$";

    @Schema(
        description = "Canonical metric key (e.g., engine.rpm, vehicle.speed, battery.voltage)",
        examples = {"engine.rpm"},
        pattern = KEY_PATTERN,
        required = true,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)}
    )
    @NotBlank(message = "Metric key is required")
    @Pattern(regexp = KEY_PATTERN, message = "Key must match pattern: lowercase segments separated by dots (2-6 segments)")
    private String k;

    @Schema(
        description = "Metric value - can be number, boolean, string, object, or array",
        examples = {"2150"},
        required = true,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)}
    )
    @NotNull(message = "Metric value is required")
    private Object v;

    @Schema(
        description = "Canonical unit of measurement (e.g., rpm, km/h, V, %, C)",
        examples = {"rpm"},
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)}
    )
    private String u;

    @Schema(
        description = "Timestamp override for this specific metric in RFC3339 format",
        examples = {"2026-01-20T14:12:00Z"},
        extensions = {@Extension(name = "x-order", value = "4", parseValue = true)}
    )
    private ZonedDateTime ts;

    @Schema(
        description = "Data source identifier",
        examples = {"obd2"},
        enumeration = {"obd2", "j1939", "can", "oem", "derived", "unknown"},
        extensions = {@Extension(name = "x-order", value = "5", parseValue = true)}
    )
    private String src;

    @Schema(
        description = "Quality indicator for the metric value",
        examples = {"ok"},
        enumeration = {"ok", "estimated", "stale", "invalid", "missing"},
        extensions = {@Extension(name = "x-order", value = "6", parseValue = true)}
    )
    private String q;

    @Schema(
        description = "Opaque metadata for traceability and debugging (e.g., PID, SPN, CAN ID)",
        extensions = {@Extension(name = "x-order", value = "7", parseValue = true)}
    )
    private Map<String, Object> meta;

    public String getK() {
        return k;
    }

    public void setK(String k) {
        this.k = k;
    }

    public Object getV() {
        return v;
    }

    public void setV(Object v) {
        this.v = v;
    }

    public String getU() {
        return u;
    }

    public void setU(String u) {
        this.u = u;
    }

    public ZonedDateTime getTs() {
        return ts;
    }

    public void setTs(ZonedDateTime ts) {
        this.ts = ts;
    }

    public String getSrc() {
        return src;
    }

    public void setSrc(String src) {
        this.src = src;
    }

    public String getQ() {
        return q;
    }

    public void setQ(String q) {
        this.q = q;
    }

    public Map<String, Object> getMeta() {
        return meta;
    }

    public void setMeta(Map<String, Object> meta) {
        this.meta = meta;
    }
}
