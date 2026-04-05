package cl.streamhub.gps.model;

import cl.streamhub.gps.model.metrics.MetricsEnvelope;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import io.quarkus.runtime.annotations.RegisterForReflection;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import java.time.ZonedDateTime;
import java.util.List;

/** AssetTrackingData */
@RegisterForReflection
@Schema(description = "Represents tracking data for an asset")
public class AssetTrackingData {

  @Schema( //
      description = "Unique identifier of the asset. E.g.: \"A123456789\"",
      example = "A123456789",
      required = true, //
      extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
  )
  @JsonProperty("asset_id")
  @NotBlank(message = "Asset ID is required and cannot be blank")
  private String assetId;

  @Schema( //
      description = "Type of asset. E.g.: \"Truck\", \"Container\", \"Pallet\"",
      example = "Truck",
      // required = true, //
      extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
  )
  // @NotBlank(message = "Asset type is required and cannot be blank")
  private String type;

  @Schema( //
      description = "Owner of the asset. E.g.: \"Company ABC\"",
      example = "Company ABC", //
      extensions = {@Extension(name = "x-order", value = "3", parseValue = true)} //
  )
  private String owner;

  @Schema( //
      description = "Year of manufacture of the asset. E.g.: 2020",
      example = "2020", //
      extensions = {@Extension(name = "x-order", value = "4", parseValue = true)} //
      )
  @PositiveOrZero(message = "Year must be a positive number")
  private Integer year;

  @Schema(
      description = "Timestamp of the data in ISO 8601 format. E.g.: \"2024-10-22T14:23:45Z\"",
      example = "2024-10-22T14:23:45Z",
      required = true, //
      extensions = {@Extension(name = "x-order", value = "5", parseValue = true)} //
      )
  @NotNull(message = "Timestamp is required")
  private ZonedDateTime timestamp;

  @Schema( //
      description =
          "Provides the geographical location of the asset and other related parameters such as altitude, "
              + "speed, and direction. This data allows real-time tracking of the asset's position.",
      extensions = {@Extension(name = "x-order", value = "6", parseValue = true)} //
      )
  @Valid
  private Gps gps;

  @Schema(
      description =
          "Describes the connectivity details of the asset, including SIM card information, GPS provider, "
              + "and signal strength, allowing real-time verification of connectivity quality.", //
      extensions = {@Extension(name = "x-order", value = "7", parseValue = true)} //
      )
  private Telecom telecom;

  @Schema( //
      description =
          "Sensor information allows monitoring of the asset's physical conditions, such as acceleration, "
              + "gyroscopes, load weight, and distance traveled. This is essential for assessing asset usage and " //
              + "conditions.",
      extensions = {@Extension(name = "x-order", value = "7", parseValue = true)} //
      )
  private Sensors sensors;

  @Schema( //
      description =
          "Provides basic information about the driver if the asset is a driven vehicle. "
              + "This section is optional depending on the asset type.",
      extensions = {@Extension(name = "x-order", value = "8", parseValue = true)} //
      )
  @JsonProperty("driver_info")
  private DriverInfo driverInfo;

  @Schema( //
      description =
          "Provides basic information about the co-driver if the asset is a driven vehicle. "
              + "This section is optional depending on the asset type.",
      extensions = {@Extension(name = "x-order", value = "9", parseValue = true)} //
      )
  @JsonProperty("co_driver_info")
  private DriverInfo coDriverInfo;

  @Schema(
      description =
          "This section describes the peripherals connected to the asset, such as cameras and RFID readers, "
              + "which can be used for visual monitoring or inventory management.",
      extensions = {@Extension(name = "x-order", value = "10", parseValue = true)} //
      )
  private Peripherals peripherals;

  @Schema(
      description =
          "Metrics envelope following miot.metrics@1.0 specification. "
              + "Provides a standardized container for telemetry metrics from OBD2, J1939, CAN, "
              + "and other vehicle/IoT data sources.",
      extensions = {@Extension(name = "x-order", value = "11", parseValue = true)} //
      )
  @Valid
  private MetricsEnvelope metrics;

  private List<Event> events;

  public String getAssetId() {
    return assetId;
  }

  public void setAssetId(String assetId) {
    this.assetId = assetId;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public String getOwner() {
    return owner;
  }

  public void setOwner(String owner) {
    this.owner = owner;
  }

  public Integer getYear() {
    return year;
  }

  public void setYear(Integer year) {
    this.year = year;
  }

  public ZonedDateTime getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(ZonedDateTime timestamp) {
    this.timestamp = timestamp;
  }

  public Gps getGps() {
    return gps;
  }

  public void setGps(Gps gps) {
    this.gps = gps;
  }

  public Telecom getTelecom() {
    return telecom;
  }

  public void setTelecom(Telecom telecom) {
    this.telecom = telecom;
  }

  public Sensors getSensors() {
    return sensors;
  }

  public void setSensors(Sensors sensors) {
    this.sensors = sensors;
  }

  public DriverInfo getDriverInfo() {
    return driverInfo;
  }

  public void setDriverInfo(DriverInfo driverInfo) {
    this.driverInfo = driverInfo;
  }

  public DriverInfo getCoDriverInfo() {
    return coDriverInfo;
  }

  public void setCoDriverInfo(DriverInfo coDriverInfo) {
    this.coDriverInfo = coDriverInfo;
  }

  public Peripherals getPeripherals() {
    return peripherals;
  }

  public void setPeripherals(Peripherals peripherals) {
    this.peripherals = peripherals;
  }

  public MetricsEnvelope getMetrics() {
    return metrics;
  }

  public void setMetrics(MetricsEnvelope metrics) {
    this.metrics = metrics;
  }

  public List<Event> getEvents() {
    return events;
  }

  public void setEvents(List<Event> events) {
    this.events = events;
  }

  public String toJson() {
    try {
      ObjectMapper mapper = new ObjectMapper();
      mapper.registerModule(new JavaTimeModule());
      mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
      return mapper.writeValueAsString(this);
    } catch (JsonProcessingException e) {
      throw new RuntimeException("Failed to serialize AssetTrackingData to JSON", e);
    }
  }
}
