package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema(description = "Remaining battery level of the GPS device as a percentage")
@RegisterForReflection
public class BatteryLevel {

    @Schema(
        description = "Battery percentage remaining",
        minimum = "0",
        maximum = "100",
        examples = {"85"}
    )
    private Double percentage;

    public Double getPercentage() {
        return percentage;
    }

    public void setPercentage(Double percentage) {
        this.percentage = percentage;
    }
}


