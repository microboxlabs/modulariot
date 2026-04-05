package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;


@Schema(description = "Odometer data")
@RegisterForReflection
public class Odometer {
    @Schema(
        description = "Total distance traveled in km",
        minimum = "0.0",
        maximum = "1000000.0",
        example = "150000.5",
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("total_distance")
    private Double totalDistance;

    @Schema(
        description = "Distance traveled in the current trip in km",
        minimum = "0.0",
        maximum = "1000000.0",
        example = "150000.5",
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    @JsonProperty("trip_distance")
    private Double tripDistance;

    public Double getTotalDistance() {
        return totalDistance;
    }

    public void setTotalDistance(Double totalDistance) {
        this.totalDistance = totalDistance;
    }

    public Double getTripDistance() {
        return tripDistance;
    }

    public void setTripDistance(Double tripDistance) {
        this.tripDistance = tripDistance;
    }


}
