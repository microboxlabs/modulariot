package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

import io.quarkus.runtime.annotations.RegisterForReflection;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;

@Schema(description = "Accuracy of the GPS data")
@RegisterForReflection
public class Accuracy {
    @Schema(
        description = "Horizontal accuracy in meters. E.g., 5.0 (high precision), 100.0 (low precision)",
        minimum = "0",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    private double horizontal;

    @Schema(
        description = "Vertical accuracy in meters. E.g., 5.0 (high precision), 50.0 (low precision)",
        minimum = "0",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    private double vertical;

    public double getHorizontal() {
        return horizontal;
    }

    public void setHorizontal(double horizontal) {
        this.horizontal = horizontal;
    }

    public double getVertical() {
        return vertical;
    }

    public void setVertical(double vertical) {
        this.vertical = vertical;
    }
}
