package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema( //
        description = "Sensor information allows monitoring of the asset's physical conditions, such as acceleration, "
                + "gyroscopes, load weight, and distance traveled. This is essential for assessing asset usage and " //
                + "conditions." //
)
@RegisterForReflection
public class Sensors {

    @Schema(description = "Acceleration data", extensions = {
            @Extension(name = "x-order", value = "1", parseValue = true) } //
    )
    private Acceleration acceleration;

    @Schema(description = "Gyroscope data", extensions = {
            @Extension(name = "x-order", value = "2", parseValue = true) } //
    )
    private Gyroscope gyroscope;

    @Schema(description = "Asset load data", extensions = {
            @Extension(name = "x-order", value = "3", parseValue = true) } //
    )
    @JsonProperty("asset_load")
    private AssetLoad assetLoad;

    @Schema(description = "Odometer data", extensions = { @Extension(name = "x-order", value = "4", parseValue = true) } //
    )
    private Odometer odometer;

    @Schema(description = "GPS device battery level", required = false, extensions = {
            @Extension(name = "x-order", value = "5", parseValue = true) })
    @JsonProperty("battery_level")
    private BatteryLevel batteryLevel;

    @Schema(description = "Engine status (true = on, false = off)", required = false, extensions = {
            @Extension(name = "x-order", value = "3", parseValue = true) } //
    )
    @JsonProperty("engine_status")
    private Boolean engineStatus;

    public Acceleration getAcceleration() {
        return acceleration;
    }

    public void setAcceleration(Acceleration acceleration) {
        this.acceleration = acceleration;
    }

    public Gyroscope getGyroscope() {
        return gyroscope;
    }

    public void setGyroscope(Gyroscope gyroscope) {
        this.gyroscope = gyroscope;
    }

    public AssetLoad getAssetLoad() {
        return assetLoad;
    }

    public void setAssetLoad(AssetLoad assetLoad) {
        this.assetLoad = assetLoad;
    }

    public Odometer getOdometer() {
        return odometer;
    }

    public void setOdometer(Odometer odometer) {
        this.odometer = odometer;
    }

    public BatteryLevel getBatteryLevel() {
        return batteryLevel;
    }

    public void setBatteryLevel(BatteryLevel batteryLevel) {
        this.batteryLevel = batteryLevel;
    }

    public Boolean getEngineStatus() {
        return engineStatus;
    }

    @JsonIgnore
    public boolean isEngineStatus() {
        return Boolean.TRUE.equals(engineStatus);
    }

    public void setEngineStatus(boolean engineStatus) {
        this.engineStatus = engineStatus;
    }
}
