package cl.streamhub.gps.model;

import java.time.ZonedDateTime;
import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema(
    description = "This section documents events related to the asset, such as speeding, G-force impacts, or sudden "
        + "movements, allowing evaluation of the asset's safety and operating conditions." //
)
@RegisterForReflection
public class Event {

    @Schema(
        description = "Type of event",
        examples = {"speeding"},
        required = true,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("event_type")
    private String eventType;

    @Schema(
        description = "Timestamp of the event in ISO format",
        examples = {"2024-10-22T14:23:45Z"},
        required = true,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    private ZonedDateTime timestamp;

    @Schema(
        description = "Severity of the event",
        examples = {"medium"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    private String severity;

    @Schema(
        description = "Description of the event",
        examples = {"Speeding over limit"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "4", parseValue = true)} //
    )
    private String description;

    @Schema(
        description = "Whether the event exceeds a threshold",
        required = false,
        extensions = {@Extension(name = "x-order", value = "5", parseValue = true)} //
    )
    @JsonProperty("threshold_exceeded")
    private Boolean thresholdExceeded;

    @Schema(
        description = "Additional information about the event",
        extensions = {@Extension(name = "x-order", value = "6", parseValue = true)} //
    )
    @JsonProperty("additional_info")
    private AdditionalInfo additionalInfo;

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public ZonedDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(ZonedDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isThresholdExceeded() {
        return Boolean.TRUE.equals(thresholdExceeded);
    }

    public void setThresholdExceeded(boolean thresholdExceeded) {
        this.thresholdExceeded = thresholdExceeded;
    }

    public AdditionalInfo getAdditionalInfo() {
        return additionalInfo;
    }

    public void setAdditionalInfo(AdditionalInfo additionalInfo) {
        this.additionalInfo = additionalInfo;
    }
}
