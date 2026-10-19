package com.microboxlabs.miot.symptoms.catalog.cel;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** CEL error messages in plain Spanish. Unknown messages pass through unchanged. */
final class RuleMessages {

    private static final Pattern OVERLOAD =
            Pattern.compile("found no matching overload for '_?([^_']+)_?' applied to '\\(([^,)]+)(?:, ([^)]+))?\\)'");
    private static final Pattern UNDEFINED_FIELD = Pattern.compile("undefined field '([^']+)'");
    private static final Pattern UNDECLARED = Pattern.compile("undeclared reference to '([^']+)'");
    private static final Pattern MISMATCHED = Pattern.compile("mismatched input '([^']+)'");
    private static final Pattern EXTRANEOUS = Pattern.compile("(?:extraneous|no viable alternative at) input '([^']+)'");

    private static final Map<String, String> TYPES = Map.of(
            "double", "número", "int", "número entero", "uint", "número entero", "string", "texto",
            "bool", "sí/no", "null_type", "vacío");

    private RuleMessages() {
    }

    static String plain(String message) {
        if (message == null) {
            return "Expresión no válida.";
        }
        Matcher m = OVERLOAD.matcher(message);
        if (m.find()) {
            String left = type(m.group(2));
            return m.group(3) == null
                    ? "No se puede usar «" + m.group(1) + "» con " + left + "."
                    : "No se puede usar «" + m.group(1) + "» entre " + left + " y " + type(m.group(3)) + ".";
        }
        m = UNDEFINED_FIELD.matcher(message);
        if (m.find()) {
            return "El campo «" + m.group(1) + "» no existe en esta fuente.";
        }
        m = UNDECLARED.matcher(message);
        if (m.find()) {
            return "«" + m.group(1) + "» no existe en esta fuente.";
        }
        m = MISMATCHED.matcher(message);
        if (m.find()) {
            return "<EOF>".equals(m.group(1))
                    ? "La expresión está incompleta."
                    : "Hay un símbolo inesperado: " + m.group(1) + ".";
        }
        m = EXTRANEOUS.matcher(message);
        if (m.find()) {
            return "Hay un símbolo inesperado: " + m.group(1) + ".";
        }
        return message;
    }

    private static String type(String cel) {
        String t = cel.trim();
        return TYPES.getOrDefault(t, t.startsWith("T_") ? "objeto" : t);
    }
}
