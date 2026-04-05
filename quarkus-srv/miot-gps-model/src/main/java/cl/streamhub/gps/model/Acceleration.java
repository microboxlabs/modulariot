package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema(description = "Acceleration data")
@RegisterForReflection
public class Acceleration {
    @Schema(
        description = "Acceleration on X-axis",
        minimum = "-3.0",
        maximum = "3.0",
        examples = {"1.5"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("x_axis")
    private Double xAxis;

    @Schema(
        description = "Acceleration on Y-axis",
        minimum = "-3.0",
        maximum = "3.0",
        examples = {"-0.5"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    @JsonProperty("y_axis")
    private Double yAxis;

    @Schema(
        description = "Acceleration on Z-axis",
        minimum = "-3.0",
        maximum = "3.0",
        examples = {"2.0"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    @JsonProperty("z_axis")
    private Double zAxis;

    @Schema(
        description = "Recorded G-force",
        minimum = "0.0",
        maximum = "5.0",
        examples = {"1.2"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    @JsonProperty("g_force")
    private Double gForce;

    public Double getxAxis() {
        return xAxis;
    }

    public void setxAxis(Double xAxis) {
        this.xAxis = xAxis;
    }

    public Double getyAxis() {
        return yAxis;
    }

    public void setyAxis(Double yAxis) {
        this.yAxis = yAxis;
    }

    public Double getzAxis() {
        return zAxis;
    }

    public void setzAxis(Double zAxis) {
        this.zAxis = zAxis;
    }

    public Double getgForce() {
        return gForce;
    }

    public void setgForce(Double gForce) {
        this.gForce = gForce;
    }
}
