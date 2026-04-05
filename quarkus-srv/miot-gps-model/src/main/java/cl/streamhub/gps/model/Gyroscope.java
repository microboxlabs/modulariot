package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema(description = "Gyroscope data")
@RegisterForReflection
public class Gyroscope {
    @Schema(
        description = "Rotation rate on X-axis",
        minimum = "-10.0",
        maximum = "10.0",
        examples = {"5.5"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("rotation_rate_x")
    private Double rotationRateX;

    @Schema(
        description = "Rotation rate on Y-axis",
        minimum = "-10.0",
        maximum = "10.0",
        examples = {"-3.2"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    @JsonProperty("rotation_rate_y")
    private Double rotationRateY;

    @Schema(
        description = "Rotation rate on Z-axis",
        minimum = "-10.0",
        maximum = "10.0",
        examples = {"1.8"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    @JsonProperty("rotation_rate_z")
    private Double rotationRateZ;

    public Double getRotationRateX() {
        return rotationRateX;
    }

    public void setRotationRateX(Double rotationRateX) {
        this.rotationRateX = rotationRateX;
    }

    public Double getRotationRateY() {
        return rotationRateY;
    }

    public void setRotationRateY(Double rotationRateY) {
        this.rotationRateY = rotationRateY;
    }

    public Double getRotationRateZ() {
        return rotationRateZ;
    }

    public void setRotationRateZ(Double rotationRateZ) {
        this.rotationRateZ = rotationRateZ;
    }
}
