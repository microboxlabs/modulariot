package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@Schema(
    description = "Provides basic information about the driver if the asset is a driven vehicle. "
        + "This section is optional depending on the asset type." //
)
@RegisterForReflection
public class DriverInfo {

    @Schema(
        description = "Unique identifier of the driver",
        example = "D12345",
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    @JsonProperty("driver_id")
    private String driverId;

    @Schema(
        description = "Name of the driver",
        example = "John Doe",
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    private String name;

    @Schema(
        description = "Driver's license number",
        example = "XYZ12345",
        required = false,
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    @JsonProperty("license_number")
    private String licenseNumber;

    @Schema(
        description = "Contact information of the driver",
        required = false,
        extensions = {@Extension(name = "x-order", value = "4", parseValue = true)} //
    )
    private Contact contact;

    @Schema(
        description = "ID Button unique identifier",
        example = "2100000095CC3B21",
        required = false,
        extensions = {@Extension(name = "x-order", value = "5", parseValue = true)}
    )
    @JsonProperty("id_button")
    private String idButton;

    public String getDriverId() {
        return driverId;
    }

    public void setDriverId(String driverId) {
        this.driverId = driverId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLicenseNumber() {
        return licenseNumber;
    }

    public void setLicenseNumber(String licenseNumber) {
        this.licenseNumber = licenseNumber;
    }

    public Contact getContact() {
        return contact;
    }

    public void setContact(Contact contact) {
        this.contact = contact;
    }

    public String getIdButton() {
        return idButton;
    }

    public void setIdButton(String idButton) {
        this.idButton = idButton;
    }
}
