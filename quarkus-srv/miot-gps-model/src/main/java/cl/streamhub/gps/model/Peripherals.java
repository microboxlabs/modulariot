package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema( //
    description = "This section describes the peripherals connected to the asset, such as cameras and RFID readers, "
        + "which can be used for visual monitoring or inventory management." //
)
@RegisterForReflection
public class Peripherals {

    @Schema( //
        description = "Dashcam information",
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    private Dashcam dashcam;

    @Schema( //
        description = "RFID reader information",
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    @JsonProperty("rfid_reader")
    private RfidReader rfidReader;

    public Dashcam getDashcam() {
        return dashcam;
    }

    public void setDashcam(Dashcam dashcam) {
        this.dashcam = dashcam;
    }

    public RfidReader getRfidReader() {
        return rfidReader;
    }

    public void setRfidReader(RfidReader rfidReader) {
        this.rfidReader = rfidReader;
    }
}
