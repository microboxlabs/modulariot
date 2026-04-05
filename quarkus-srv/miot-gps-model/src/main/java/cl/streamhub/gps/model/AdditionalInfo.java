package cl.streamhub.gps.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

@Schema(description = "Additional information about the event")
@RegisterForReflection
public class AdditionalInfo {
    @Schema(
        description = "G-force during the event",
        minimum = "0.0",
        maximum = "5.0",
        example = "2.5",
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("g_force")
    private Double gForce;

    @Schema(
        description = "Speed during the event in km/h",
        minimum = "0.0",
        maximum = "250.0",
        example = "120.5",
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    @JsonProperty("speed_at_event")
    private Double speedAtEvent;

    @Schema(
        description = "Cargo weight at the time of the event in kg",
        minimum = "0.0",
        maximum = "20000.0",
        example = "5000.0",
        required = false,
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    @JsonProperty("cargo_weight")
    private Double cargoWeight;

    public Double getgForce() {
        return gForce;
    }

    public void setgForce(Double gForce) {
        this.gForce = gForce;
    }

    public Double getSpeedAtEvent() {
        return speedAtEvent;
    }

    public void setSpeedAtEvent(Double speedAtEvent) {
        this.speedAtEvent = speedAtEvent;
    }

    public Double getCargoWeight() {
        return cargoWeight;
    }

    public void setCargoWeight(Double cargoWeight) {
        this.cargoWeight = cargoWeight;
    }
}
