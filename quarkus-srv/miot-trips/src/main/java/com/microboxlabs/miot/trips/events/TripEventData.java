package com.microboxlabs.miot.trips.events;

import java.time.Instant;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** The data of every {@code trip.*} event. A field that does not apply to the event's type is null. */
@Schema(title = "Viaje")
public record TripEventData(
        @Schema(title = "Viaje", description = "The trip id") String tripId,
        @Schema(title = "Servicio", description = "The external code of the trip's first mandate") String serviceCode,
        @Schema(title = "Referencia", description = "The order reference of that mandate") String orderRef,
        @Schema(title = "Origen", description = "The origin's name") String origin,
        @Schema(title = "Destino", description = "The destination's name") String destination,
        @Schema(title = "Salida programada", description = "The planned departure") Instant plannedStart,
        @Schema(title = "Llegada programada", description = "The latest planned end of the trip's stages")
        Instant plannedEnd,
        @Schema(title = "Camión", description = "The truck's plate") String truck,
        @Schema(title = "Rampla", description = "The trailer's plate") String trailer,
        @Schema(title = "Conductor", description = "The main driver's document") String driver,
        @Schema(title = "Transportista", description = "The legal name of the truck's carrier") String carrierName,
        @Schema(title = "RUT del transportista",
                description = "The carrier's RUT without dots or dashes, upper case") String carrierRut,
        @Schema(title = "Monitor", description = "The monitor key and version that raised the event") String monitor,
        @Schema(title = "Alerta", description = "The alert key, for trip.alert") String alert,
        @Schema(title = "Regla", description = "The rule that raised the alert or the detection") String rule,
        @Schema(title = "Hito", description = "departure, arrival or closure") String milestone,
        @Schema(title = "Fuente", description = "What detected the milestone: gps, eta, …") String source,
        @Schema(title = "Hora detectada", description = "The time the detection proposes") Instant proposedAt,
        @Schema(title = "Hora confirmada", description = "The confirmed time") Instant confirmedAt,
        @Schema(title = "Hora informada", description = "The other time a conflicting confirmation gave")
        Instant otherAt,
        @Schema(title = "Canal", description = "Where the confirmation came from: feed, reply, ui, api") String channel,
        @Schema(title = "Quién", description = "Who confirmed, rejected or changed it") String actor,
        @Schema(title = "Campos", description = "The fields the feed changed on a closed trip")
        List<String> changedFields) {

    /** The trip part, with nothing about the event yet. */
    public static TripEventData trip(String tripId, String serviceCode, String orderRef, String origin,
            String destination, Instant plannedStart, Instant plannedEnd, String truck, String trailer,
            String driver, String carrierName, String carrierRut) {
        return new TripEventData(tripId, serviceCode, orderRef, origin, destination, plannedStart, plannedEnd,
                truck, trailer, driver, carrierName, carrierRut, null, null, null, null, null, null, null, null, null, null, null);
    }

    public TripEventData alert(String monitor, String alert, String rule) {
        return new TripEventData(tripId, serviceCode, orderRef, origin, destination, plannedStart, plannedEnd,
                truck, trailer, driver, carrierName, carrierRut, monitor, alert, rule, null, null, null, null, null, null, null, null);
    }

    public TripEventData milestone(String milestone, String source, Instant proposedAt, Instant confirmedAt,
            Instant otherAt, String channel, String actor, String rule) {
        return new TripEventData(tripId, serviceCode, orderRef, origin, destination, plannedStart, plannedEnd,
                truck, trailer, driver, carrierName, carrierRut, monitor, null, rule, milestone, source, proposedAt, confirmedAt, otherAt,
                channel, actor, null);
    }

    public TripEventData changed(List<String> fields, String actor) {
        return new TripEventData(tripId, serviceCode, orderRef, origin, destination, plannedStart, plannedEnd,
                truck, trailer, driver, carrierName, carrierRut, null, null, null, null, null, null, null, null, null, actor,
                List.copyOf(fields));
    }
}
