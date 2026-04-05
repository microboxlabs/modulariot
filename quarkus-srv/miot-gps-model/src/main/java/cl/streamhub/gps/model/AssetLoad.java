package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;


@Schema(description = "Asset load data")
@RegisterForReflection
public class AssetLoad {
    @Schema(
        description = "Cargo weight in kg",
        minimum = "0.0",
        maximum = "20000.0",
        examples = {"5000.0"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("cargo_weight")
    private Double cargoWeight;

    @Schema(
        description = "Asset weight in kg",
        minimum = "0.0",
        maximum = "10000.0",
        examples = {"3500.0"},
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    @JsonProperty("asset_weight")
    private Double assetWeight;

    public Double getCargoWeight() {
        return cargoWeight;
    }

    public void setCargoWeight(Double cargoWeight) {
        this.cargoWeight = cargoWeight;
    }

    public Double getAssetWeight() {
        return assetWeight;
    }

    public void setAssetWeight(Double assetWeight) {
        this.assetWeight = assetWeight;
    }
}
