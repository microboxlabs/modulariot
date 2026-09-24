package com.microboxlabs.miot.core.selectable;

import static com.microboxlabs.miot.core.selectable.SelectableOption.of;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * General-purpose lists every organization starts with. Each one also shows a
 * different thing a list can do: colors and icons, groups, tags, a selection
 * cap, a list filtered by another, disabled options, and lists fed by a system
 * source.
 */
@ApplicationScoped
public class GeneralSelectables implements SelectableDefaults {

    static final String REGION = "region";

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        return List.of(
                priority(), yesNo(), incidentType(), delayReason(), cargoTags(), documentType(), vehicleType(),
                contactRole(), shift(), weekdays(), satisfaction(), unitOfMeasure(), region(), commune(),
                timezone(), currency());
    }

    /** Colors and icons. */
    static Selectable priority() {
        return list("priority", "Prioridad", "Priority",
                "Urgencia de una tarea, incidente o solicitud.", "How urgent a task, incident or request is.",
                SelectionMode.SINGLE, List.of(
                        of("low", "Baja", "Low").withLook("gray", "arrow-down"),
                        of("medium", "Media", "Medium").withLook("blue", "minus"),
                        of("high", "Alta", "High").withLook("yellow", "arrow-up"),
                        of("critical", "Crítica", "Critical").withLook("red", "fire")
                                .withDescription("Atender de inmediato.", "Handle right away.")));
    }

    static Selectable yesNo() {
        return list("yes_no", "Sí / No / No aplica", "Yes / No / Not applicable",
                "Respuesta cerrada para checklists e inspecciones.", "Closed answer for checklists and inspections.",
                SelectionMode.SINGLE, List.of(
                        of("yes", "Sí", "Yes").withLook("green", "check"),
                        of("no", "No", "No").withLook("red", "x"),
                        of("n_a", "No aplica", "Not applicable").withLook("gray", "ban")));
    }

    /** Groups. */
    static Selectable incidentType() {
        return list("incident_type", "Tipo de incidente", "Incident type",
                "Qué pasó durante un viaje, agrupado por origen.", "What happened on a trip, grouped by cause.",
                SelectionMode.SINGLE, List.of(
                        of("mechanical_failure", "Falla mecánica", "Mechanical failure").withGroup("vehicle"),
                        of("flat_tire", "Pinchazo", "Flat tire").withGroup("vehicle"),
                        of("accident", "Accidente", "Accident").withGroup("vehicle").withLook("red", "exclamation"),
                        of("cargo_damage", "Carga dañada", "Damaged cargo").withGroup("cargo"),
                        of("cargo_shortage", "Faltante de carga", "Cargo shortage").withGroup("cargo"),
                        of("fatigue", "Fatiga", "Fatigue").withGroup("driver"),
                        of("no_show", "Conductor no se presenta", "Driver no-show").withGroup("driver"),
                        of("road_block", "Ruta bloqueada", "Road blocked").withGroup("external"),
                        of("weather", "Clima", "Weather").withGroup("external")))
                .withGroups(List.of(
                        SelectableGroup.of("vehicle", "Vehículo", "Vehicle"),
                        SelectableGroup.of("cargo", "Carga", "Cargo"),
                        SelectableGroup.of("driver", "Conductor", "Driver"),
                        SelectableGroup.of("external", "Externo", "External")));
    }

    /** Groups, several choices, a cap and a placeholder. */
    static Selectable delayReason() {
        return list("delay_reason", "Motivo de retraso", "Delay reason",
                "Hasta tres causas de un atraso.", "Up to three causes of a delay.",
                SelectionMode.MULTIPLE, List.of(
                        of("late_loading", "Carga tardía", "Late loading").withGroup("origin"),
                        of("missing_documents", "Documentos pendientes", "Missing documents").withGroup("origin"),
                        of("traffic", "Tráfico", "Traffic").withGroup("route"),
                        of("detour", "Desvío", "Detour").withGroup("route"),
                        of("mandatory_rest", "Descanso obligatorio", "Mandatory rest").withGroup("route"),
                        of("dock_busy", "Andén ocupado", "Dock busy").withGroup("destination"),
                        of("receiver_closed", "Destinatario cerrado", "Receiver closed").withGroup("destination")))
                .withGroups(List.of(
                        SelectableGroup.of("origin", "En origen", "At origin"),
                        SelectableGroup.of("route", "En ruta", "On the road"),
                        SelectableGroup.of("destination", "En destino", "At destination")))
                .withSettings(new SelectableSettings(true, false, null, 3,
                        Localized.of("Elige hasta tres motivos", "Pick up to three reasons")));
    }

    /** Tags: people may add values that are not in the list. */
    static Selectable cargoTags() {
        return list("cargo_tags", "Características de la carga", "Cargo characteristics",
                "Etiquetas libres; se puede escribir una nueva.", "Free tags; a new one can be typed in.",
                SelectionMode.MULTIPLE, List.of(
                        of("fragile", "Frágil", "Fragile").withLook("yellow", "exclamation"),
                        of("refrigerated", "Refrigerada", "Refrigerated").withLook("cyan", "snow"),
                        of("hazardous", "Peligrosa (IMO)", "Hazardous (IMO)").withLook("red", "fire"),
                        of("oversized", "Sobredimensionada", "Oversized").withLook("purple", "cube"),
                        of("high_value", "Alto valor", "High value").withLook("green", "currency")))
                .withSettings(SelectableSettings.tags());
    }

    static Selectable documentType() {
        return list("document_type", "Tipo de documento", "Document type",
                "Documentos que acompañan un envío.", "Documents that travel with a shipment.",
                SelectionMode.SINGLE, List.of(
                        of("dispatch_guide", "Guía de despacho", "Dispatch guide").withLook(null, "document"),
                        of("invoice", "Factura", "Invoice").withLook(null, "document"),
                        of("purchase_order", "Orden de compra", "Purchase order").withLook(null, "document"),
                        of("proof_of_delivery", "Comprobante de entrega (POD)", "Proof of delivery (POD)")
                                .withLook(null, "check"),
                        of("bill_of_lading", "Conocimiento de embarque", "Bill of lading").withLook(null, "document"),
                        of("packing_list", "Lista de empaque", "Packing list").withLook(null, "cube")));
    }

    /** A disabled option. */
    static Selectable vehicleType() {
        return list("vehicle_type", "Tipo de vehículo", "Vehicle type",
                "Configuraciones de vehículo de carga.", "Freight vehicle configurations.",
                SelectionMode.SINGLE, List.of(
                        of("pickup", "Camioneta", "Pickup").withLook(null, "truck"),
                        of("truck_3_4", "Camión 3/4", "Light truck").withLook(null, "truck"),
                        of("rigid_truck", "Camión rígido", "Rigid truck").withLook(null, "truck"),
                        of("tractor_trailer", "Tracto con semirremolque", "Tractor-trailer").withLook(null, "truck"),
                        of("tanker", "Camión cisterna", "Tanker").withLook(null, "truck"),
                        of("reefer", "Camión refrigerado", "Refrigerated truck").withLook("cyan", "snow"),
                        of("dump_truck", "Tolva", "Dump truck").withLook(null, "truck"),
                        of("lowboy", "Cama baja", "Lowboy").withLook(null, "truck")
                                .withDescription("Aún no disponible en la flota.", "Not in the fleet yet.")
                                .asDisabled()));
    }

    static Selectable contactRole() {
        return list("contact_role", "Rol de contacto", "Contact role",
                "Quién es la persona a la que se llama o escribe.", "Who the person being contacted is.",
                SelectionMode.SINGLE, List.of(
                        of("driver", "Conductor", "Driver").withLook(null, "user"),
                        of("dispatcher", "Despachador", "Dispatcher").withLook(null, "phone"),
                        of("supervisor", "Supervisor", "Supervisor").withLook(null, "shield"),
                        of("customer", "Cliente", "Customer").withLook(null, "user"),
                        of("carrier", "Transportista", "Carrier").withLook(null, "truck"),
                        of("warehouse", "Bodega", "Warehouse").withLook(null, "cube")));
    }

    static Selectable shift() {
        return list("shift", "Turno", "Shift", "Turnos de trabajo.", "Work shifts.",
                SelectionMode.SINGLE, List.of(
                        of("morning", "Mañana", "Morning").withLook("yellow", "sun")
                                .withDescription("06:00 – 14:00", "06:00 – 14:00"),
                        of("afternoon", "Tarde", "Afternoon").withLook("indigo", "clock")
                                .withDescription("14:00 – 22:00", "14:00 – 22:00"),
                        of("night", "Noche", "Night").withLook("purple", "moon")
                                .withDescription("22:00 – 06:00", "22:00 – 06:00")));
    }

    /** Several choices; values are ISO day codes. */
    static Selectable weekdays() {
        return list("weekdays", "Días de la semana", "Days of the week",
                "Días de operación, ventanas de entrega o turnos.", "Operating days, delivery windows or shifts.",
                SelectionMode.MULTIPLE, List.of(
                        of("MON", "Lunes", "Monday"), of("TUE", "Martes", "Tuesday"),
                        of("WED", "Miércoles", "Wednesday"), of("THU", "Jueves", "Thursday"),
                        of("FRI", "Viernes", "Friday"), of("SAT", "Sábado", "Saturday").withGroup("weekend"),
                        of("SUN", "Domingo", "Sunday").withGroup("weekend")))
                .withGroups(List.of(SelectableGroup.of("weekend", "Fin de semana", "Weekend")))
                .withSettings(new SelectableSettings(false, false, null, null, Map.of()));
    }

    /** A scale: values are numbers, colors go from red to green. */
    static Selectable satisfaction() {
        return list("satisfaction", "Nivel de satisfacción", "Satisfaction",
                "Encuesta de 1 a 5.", "A 1 to 5 survey.",
                SelectionMode.SINGLE, List.of(
                        of("1", "1 — Muy malo", "1 — Very poor").withLook("red", "star"),
                        of("2", "2 — Malo", "2 — Poor").withLook("yellow", "star"),
                        of("3", "3 — Regular", "3 — Fair").withLook("gray", "star"),
                        of("4", "4 — Bueno", "4 — Good").withLook("lime", "star"),
                        of("5", "5 — Excelente", "5 — Excellent").withLook("green", "star")))
                .withSettings(new SelectableSettings(false, false, null, null, Map.of()));
    }

    static Selectable unitOfMeasure() {
        return list("unit_of_measure", "Unidad de medida", "Unit of measure",
                "Unidades para peso, volumen y bultos.", "Units for weight, volume and packages.",
                SelectionMode.SINGLE, List.of(
                        of("kg", "Kilogramo (kg)", "Kilogram (kg)").withGroup("weight"),
                        of("t", "Tonelada (t)", "Tonne (t)").withGroup("weight"),
                        of("lb", "Libra (lb)", "Pound (lb)").withGroup("weight")
                                .withDescription("No se usa en Chile.", "Not used in Chile.").asDisabled(),
                        of("m3", "Metro cúbico (m³)", "Cubic metre (m³)").withGroup("volume"),
                        of("l", "Litro (l)", "Litre (l)").withGroup("volume"),
                        of("unit", "Unidad", "Unit").withGroup("count"),
                        of("box", "Caja", "Box").withGroup("count"),
                        of("pallet", "Pallet", "Pallet").withGroup("count")))
                .withGroups(List.of(
                        SelectableGroup.of("weight", "Peso", "Weight"),
                        SelectableGroup.of("volume", "Volumen", "Volume"),
                        SelectableGroup.of("count", "Bultos", "Packages")));
    }

    /** Values are ISO 3166-2 codes; {@link #commune()} is filtered by it. */
    static Selectable region() {
        return list(REGION, "Región (Chile)", "Region (Chile)",
                "Regiones de Chile; el valor es el código ISO 3166-2.", "Regions of Chile; the value is the ISO 3166-2 code.",
                SelectionMode.SINGLE, List.of(
                        of("CL-AP", "Arica y Parinacota", "Arica y Parinacota"),
                        of("CL-TA", "Tarapacá", "Tarapacá"),
                        of("CL-AN", "Antofagasta", "Antofagasta"),
                        of("CL-AT", "Atacama", "Atacama"),
                        of("CL-CO", "Coquimbo", "Coquimbo"),
                        of("CL-VS", "Valparaíso", "Valparaíso"),
                        of("CL-RM", "Metropolitana de Santiago", "Santiago Metropolitan"),
                        of("CL-LI", "O'Higgins", "O'Higgins"),
                        of("CL-ML", "Maule", "Maule"),
                        of("CL-NB", "Ñuble", "Ñuble"),
                        of("CL-BI", "Biobío", "Biobío"),
                        of("CL-AR", "La Araucanía", "La Araucanía"),
                        of("CL-LR", "Los Ríos", "Los Ríos"),
                        of("CL-LL", "Los Lagos", "Los Lagos"),
                        of("CL-AI", "Aysén", "Aysén"),
                        of("CL-MA", "Magallanes", "Magallanes")))
                .withSettings(new SelectableSettings(true, false, null, null,
                        Localized.of("Busca una región", "Search a region")));
    }

    /** Filtered by the region picked: each option's parent is a region value. A sample, not every commune. */
    static Selectable commune() {
        List<SelectableOption> options = new ArrayList<>();
        addCommunes(options, "CL-AN", "Antofagasta", "Calama", "Mejillones", "Tocopilla");
        addCommunes(options, "CL-AT", "Copiapó", "Vallenar");
        addCommunes(options, "CL-CO", "La Serena", "Coquimbo", "Ovalle");
        addCommunes(options, "CL-VS", "Valparaíso", "Viña del Mar", "San Antonio", "Los Andes", "Quillota");
        addCommunes(options, "CL-RM", "Santiago", "Providencia", "Las Condes", "Maipú", "Pudahuel", "Quilicura",
                "San Bernardo", "Puente Alto");
        addCommunes(options, "CL-BI", "Concepción", "Talcahuano", "Coronel", "Los Ángeles");
        addCommunes(options, "CL-LL", "Puerto Montt", "Osorno", "Castro");
        return list("commune", "Comuna", "Commune",
                "Muestra de comunas, filtrada por la región elegida.", "A sample of communes, filtered by the region picked.",
                SelectionMode.SINGLE, options)
                .withSettings(new SelectableSettings(true, false, REGION, null,
                        Localized.of("Primero elige una región", "Pick a region first")));
    }

    /** Fed by a system source: options are fetched, not stored. */
    static Selectable timezone() {
        return list("timezone", "Zona horaria", "Time zone",
                "Todas las zonas horarias, obtenidas del sistema.", "Every time zone, fetched from the system.",
                SelectionMode.SINGLE, List.of())
                .withSource(SelectableSource.system(CoreSystemSources.TimeZones.ID));
    }

    static Selectable currency() {
        return list("currency", "Moneda", "Currency",
                "Monedas ISO 4217, obtenidas del sistema.", "ISO 4217 currencies, fetched from the system.",
                SelectionMode.SINGLE, List.of())
                .withSource(SelectableSource.system(CoreSystemSources.Currencies.ID));
    }

    private static void addCommunes(List<SelectableOption> into, String region, String... names) {
        for (String name : names) {
            into.add(of(SelectableRules.slug(name), name, name).withParent(region));
        }
    }

    private static Selectable list(String key, String nameEs, String nameEn, String descriptionEs,
            String descriptionEn, SelectionMode mode, List<SelectableOption> options) {
        return Selectable.of(key, nameEs, nameEn, descriptionEs, descriptionEn, mode, options);
    }
}
