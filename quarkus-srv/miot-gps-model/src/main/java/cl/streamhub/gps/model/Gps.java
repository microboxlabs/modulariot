package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema( //
    description = "Provides the geographical location of the asset and other related parameters such as altitude, "
        + "speed, and direction. This data allows real-time tracking of the asset's position." //
)
@RegisterForReflection
public class Gps {
    @Schema(
        description = "Latitude of the asset",
        minimum = "-90",
        maximum = "90",
        required = true, //
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    private double latitude;

    @Schema(
        description = "Longitude of the asset",
        minimum = "-180",
        maximum = "180",
        required = true, //
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    private double longitude;

    @Schema(
        description = "Altitude in meters. E.g., -50.0 (below sea level), 1000.0 (mountain)",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    private double altitude;

    @Schema(
        description = "Speed of the asset in km/h",
        minimum = "0",
        maximum = "250",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "4", parseValue = true)} //
    )
    private double speed;

    @Schema(
        description = "Direction in degrees",
        minimum = "0",
        maximum = "360",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "5", parseValue = true)} //
    )
    private double heading;

    @Schema(
        description = "Accuracy of the GPS data",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "6", parseValue = true)} //
    )
    private Accuracy accuracy;

    @Schema(
        description = "Number of satellites used",
        minimum = "0",
        maximum = "30",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "7", parseValue = true)} //
    )
    private int satellites;

    public double getLatitude() {
        return latitude;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public double getAltitude() {
        return altitude;
    }

    public void setAltitude(double altitude) {
        this.altitude = altitude;
    }

    public double getSpeed() {
        return speed;
    }

    public void setSpeed(double speed) {
        this.speed = speed;
    }

    public double getHeading() {
        return heading;
    }

    public void setHeading(double heading) {
        this.heading = heading;
    }

    public Accuracy getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Accuracy accuracy) {
        this.accuracy = accuracy;
    }

    public int getSatellites() {
        return satellites;
    }

    public void setSatellites(int satellites) {
        this.satellites = satellites;
    }
}
