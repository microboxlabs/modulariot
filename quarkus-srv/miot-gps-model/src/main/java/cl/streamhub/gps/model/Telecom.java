package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;

@Schema(
    description = "Describes the connectivity details of the asset, including SIM card information, GPS provider, "
        + "and signal strength, allowing real-time verification of connectivity quality." //
)
@RegisterForReflection
public class Telecom {

    @Schema(
        description = "ICCID (Integrated Circuit Card Identifier) of the SIM card",
        example = "89012345678901234567",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    private String iccid;

    @Schema(
        description = "IMSI (International Mobile Subscriber Identity) of the SIM card",
        example = "123456789012345",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    private String imsi;

    @Schema(
        description = "Name of the mobile network operator",
        example = "Vodafone",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
    )
    private String operator;

    @Schema(
        description = "Mobile Country Code",
        example = "234",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "4", parseValue = true)} //
    )
    private String mcc;

    @Schema(
        description = "Mobile Network Code",
        example = "15",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "5", parseValue = true)} //
    )
    private String mnc;

    @Schema(
        description = "Cell ID of the connected cell tower",
        example = "12345",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "6", parseValue = true)} //
    )
    @JsonProperty("cell_id")
    private String cellId;

    @Schema(
        description = "Location Area Code",
        example = "1234",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "7", parseValue = true)} //
    )
    private String lac;

    @Schema(
        description = "Signal strength in dBm",
        minimum = "-120",
        maximum = "-30",
        example = "-85",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "8", parseValue = true)} //
    )
    @JsonProperty("signal_strength")
    private Integer signalStrength;

    @Schema(
        description = "Name of the GPS provider",
        example = "Garmin",
        required = false, //
        extensions = {@Extension(name = "x-order", value = "9", parseValue = true)} //
    )
    @JsonProperty("gps_provider")
    private String gpsProvider;

    public String getIccid() {
        return iccid;
    }

    public void setIccid(String iccid) {
        this.iccid = iccid;
    }

    public String getImsi() {
        return imsi;
    }

    public void setImsi(String imsi) {
        this.imsi = imsi;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getMcc() {
        return mcc;
    }

    public void setMcc(String mcc) {
        this.mcc = mcc;
    }

    public String getMnc() {
        return mnc;
    }

    public void setMnc(String mnc) {
        this.mnc = mnc;
    }

    public String getCellId() {
        return cellId;
    }

    public void setCellId(String cellId) {
        this.cellId = cellId;
    }

    public String getLac() {
        return lac;
    }

    public void setLac(String lac) {
        this.lac = lac;
    }

    public Integer getSignalStrength() {
        return signalStrength;
    }

    public void setSignalStrength(Integer signalStrength) {
        this.signalStrength = signalStrength;
    }

    public String getGpsProvider() {
        return gpsProvider;
    }

    public void setGpsProvider(String gpsProvider) {
        this.gpsProvider = gpsProvider;
    }


}
