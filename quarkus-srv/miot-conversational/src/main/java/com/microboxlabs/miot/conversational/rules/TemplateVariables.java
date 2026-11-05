package com.microboxlabs.miot.conversational.rules;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The variables a template can use, {@code {{name}}}: every field of the event's data, plus the derived ones in
 * {@link #DERIVED}. A variable without a value renders empty.
 */
public final class TemplateVariables {

    /** A derived variable, for the event catalog. */
    public record Derived(String name, String label, String description) {
    }

    public static final List<Derived> DERIVED = List.of(
            new Derived("hora", "Hora", "Hora del evento en Chile, HH:mm"),
            new Derived("fecha", "Fecha", "Fecha del evento en Chile, dd-MM-yyyy"),
            new Derived("nombre", "Nombre", "Nombre del destinatario, o \"conductor\""),
            new Derived("patente", "Patente", "Patente del vehículo, o su id"),
            new Derived("sintoma", "Síntoma", "Nombre del síntoma"),
            new Derived("nivel", "Nivel", "Nivel del caso: Bajo observación, Comprometida, Crítica, Código negro"),
            new Derived("ubicacion", "Ubicación", "Latitud y longitud, con 5 decimales"));

    static final ZoneId ZONE = ZoneId.of("America/Santiago");
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final Map<Integer, String> LEVELS = Map.of(1, "Bajo observación", 2, "Comprometida", 3,
            "Crítica", 4, "Código negro");
    private static final String DEFAULT_NAME = "conductor";
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{\\s*([\\w.]+)\\s*}}");

    private TemplateVariables() {
    }

    /** The variables for one recipient; {@code recipientName} may be null. */
    public static Map<String, String> of(Map<String, Object> data, Instant at, String recipientName) {
        Map<String, Object> d = data == null ? Map.of() : data;
        Map<String, String> out = new LinkedHashMap<>();
        d.forEach((k, v) -> {
            if (v != null) {
                out.put(k, text(v));
            }
        });
        if (at != null) {
            out.put("hora", HOUR.format(at.atZone(ZONE)));
            out.put("fecha", DATE.format(at.atZone(ZONE)));
        }
        out.put("nombre", recipientName == null || recipientName.isBlank() ? DEFAULT_NAME : recipientName);
        Object plate = either(d, "plate", "assetId");
        if (plate != null) {
            out.put("patente", text(plate));
        }
        if (d.get("symptomName") != null) {
            out.put("sintoma", text(d.get("symptomName")));
        }
        Integer level = integer(d.get("level"));
        if (level != null && LEVELS.containsKey(level)) {
            out.put("nivel", LEVELS.get(level));
        }
        Double lat = number(either(d, "latitude", "lat"));
        Double lon = number(either(d, "longitude", "lon"));
        if (lat != null && lon != null) {
            out.put("ubicacion", String.format(Locale.ROOT, "%.5f, %.5f", lat, lon));
        }
        return out;
    }

    public static String render(String text, Map<String, String> variables) {
        if (text == null) {
            return null;
        }
        Matcher m = VARIABLE.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String value = variables.getOrDefault(m.group(1), "");
            m.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        m.appendTail(out);
        return out.toString();
    }

    /** The value of {@code first}, else of {@code second}. */
    private static Object either(Map<String, Object> data, String first, String second) {
        Object value = data.get(first);
        return value != null ? value : data.get(second);
    }

    /** Whole numbers without decimals; other values as text. */
    static String text(Object value) {
        if (value instanceof Double || value instanceof Float || value instanceof BigDecimal) {
            BigDecimal d = new BigDecimal(String.valueOf(value)).stripTrailingZeros();
            return d.scale() <= 0 ? d.toBigInteger().toString() : d.toPlainString();
        }
        return String.valueOf(value);
    }

    private static Integer integer(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        try {
            return value == null ? null : Integer.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double number(Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return value == null ? null : Double.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
