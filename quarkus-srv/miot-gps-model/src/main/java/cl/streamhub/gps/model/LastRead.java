package cl.streamhub.gps.model;

import java.time.ZonedDateTime;
import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema(description = "Last read RFID information")
@RegisterForReflection
public class LastRead {
    @Schema(
        description = "Last read RFID tag",
        example = "RFID12345",
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("rfid_tag")
    private String rfidTag;

    @Schema(
        description = "Timestamp of the last read",
        example = "2024-10-22T14:23:45Z",
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    private ZonedDateTime timestamp;

    public String getRfidTag() {
        return rfidTag;
    }

    public void setRfidTag(String rfidTag) {
        this.rfidTag = rfidTag;
    }

    public ZonedDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(ZonedDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
