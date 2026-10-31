package com.microboxlabs.miot.conversational.service;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A message template on the WABA as the app shows it: Meta's components flattened to a text header, body,
 * footer and buttons. {@code params} are the body's parameters in order, the ones a send fills;
 * {@code examples} holds the example of every header and body parameter. {@code headerFormat} is TEXT,
 * IMAGE, VIDEO, DOCUMENT or LOCATION, or null without a header; {@code header} is its text when TEXT.
 */
public record WhatsAppTemplate(
        String id,
        String name,
        String language,
        String category,
        String status,
        String rejectedReason,
        String parameterFormat,
        String headerFormat,
        String header,
        String body,
        String footer,
        List<Button> buttons,
        List<String> params,
        Map<String, String> examples) {

    /** A QUICK_REPLY, URL or PHONE_NUMBER button; {@code url} and {@code phoneNumber} go with their type. */
    public record Button(String type, String text, String url, String phoneNumber) {
    }

    static final Pattern PARAM = Pattern.compile("\\{\\{([^{}]*)}}");

    /** The parameter names in {@code text}, in order of first use. */
    public static List<String> paramsOf(String text) {
        Set<String> out = new LinkedHashSet<>();
        if (text != null) {
            Matcher m = PARAM.matcher(text);
            while (m.find()) {
                out.add(m.group(1).trim());
            }
        }
        return List.copyOf(out);
    }

    /** Reads Meta's template JSON. */
    public static WhatsAppTemplate from(JsonObject meta) {
        String headerFormat = null;
        String header = null;
        String body = null;
        String footer = null;
        List<Button> buttons = new ArrayList<>();
        Map<String, String> examples = new LinkedHashMap<>();
        JsonArray components = meta.getJsonArray("components", new JsonArray());
        for (int i = 0; i < components.size(); i++) {
            JsonObject c = components.getJsonObject(i);
            String type = String.valueOf(upper(c.getString("type")));
            JsonObject example = c.getJsonObject("example");
            switch (type) {
                case "HEADER" -> {
                    headerFormat = upper(c.getString("format", "TEXT"));
                    header = c.getString("text");
                    readExamples(header, example, "header_text_named_params", "header_text", examples);
                }
                case "BODY" -> {
                    body = c.getString("text");
                    readExamples(body, example, "body_text_named_params", "body_text", examples);
                }
                case "FOOTER" -> footer = c.getString("text");
                case "BUTTONS" -> {
                    JsonArray list = c.getJsonArray("buttons", new JsonArray());
                    for (int j = 0; j < list.size(); j++) {
                        JsonObject b = list.getJsonObject(j);
                        buttons.add(new Button(upper(b.getString("type")), b.getString("text"), b.getString("url"),
                                b.getString("phone_number")));
                    }
                }
                default -> {
                    // Carousels and other components are not shown.
                }
            }
        }
        String rejected = meta.getString("rejected_reason");
        return new WhatsAppTemplate(meta.getString("id"), meta.getString("name"), meta.getString("language"),
                upper(meta.getString("category")), upper(meta.getString("status")),
                rejected == null || "NONE".equalsIgnoreCase(rejected) ? null : rejected,
                upper(meta.getString("parameter_format", "POSITIONAL")), headerFormat, header, body, footer,
                List.copyOf(buttons), paramsOf(body), examples);
    }

    /** Named examples ({@code [{param_name, example}]}), else positional ones ({@code [["a", "b"]]} or {@code ["a"]}). */
    private static void readExamples(String text, JsonObject example, String namedKey, String positionalKey,
            Map<String, String> out) {
        if (example == null) {
            return;
        }
        JsonArray named = example.getJsonArray(namedKey);
        if (named != null) {
            for (int i = 0; i < named.size(); i++) {
                JsonObject p = named.getJsonObject(i);
                out.put(p.getString("param_name"), p.getString("example"));
            }
            return;
        }
        if (!(example.getValue(positionalKey) instanceof JsonArray values)) {
            return;
        }
        if (!values.isEmpty() && values.getValue(0) instanceof JsonArray inner) {
            values = inner;
        }
        List<String> params = paramsOf(text);
        for (int i = 0; i < values.size() && i < params.size(); i++) {
            out.put(params.get(i), String.valueOf(values.getValue(i)));
        }
    }

    private static String upper(String s) {
        return s == null ? null : s.toUpperCase(Locale.ROOT);
    }
}
