package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema(description = "RFID reader information")
@RegisterForReflection
public class RfidReader {

    @Schema( //
        description = "Status of the RFID reader (true = functioning)",
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    private Boolean status;


    @Schema( //
        description = "Last read RFID information",
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    @JsonProperty("last_read")
    private LastRead lastRead;

    public Boolean getStatus() {
        return status;
    }

    public void setStatus(Boolean status) {
        this.status = status;
    }

    public LastRead getLastRead() {
        return lastRead;
    }

    public void setLastRead(LastRead lastRead) {
        this.lastRead = lastRead;
    }
}
