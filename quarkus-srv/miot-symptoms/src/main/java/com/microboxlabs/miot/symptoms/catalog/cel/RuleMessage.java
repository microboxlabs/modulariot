package com.microboxlabs.miot.symptoms.catalog.cel;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A problem in a rule as a code and its parameters, which the app translates.
 * {@link #spanish()} is the text for logs and for clients that do not know the code.
 *
 * @param code   key in {@value #TEXTS} and, as {@code finding<Code>}, in the app's lang files
 * @param params values for the code's placeholders; {@code level*} hold a level number, {@code left}
 *               and {@code right} a CEL type
 */
public record RuleMessage(String code, Map<String, String> params) {

    static final String TEXTS = "/symptoms/rule-messages.properties";
    private static final Properties SPANISH = load();
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\w+)}");

    public RuleMessage {
        Map<String, String> given = new LinkedHashMap<>();
        if (params != null) {
            params.forEach((name, value) -> {
                if (name != null && value != null) {
                    given.put(name, value);
                }
            });
        }
        params = Map.copyOf(given);
    }

    public static RuleMessage of(String code) {
        return new RuleMessage(code, Map.of());
    }

    /** A code with its parameters given as name, value, name, value. */
    public static RuleMessage of(String code, Object... nameValues) {
        Map<String, String> params = new LinkedHashMap<>();
        for (int i = 0; i + 1 < nameValues.length; i += 2) {
            params.put(String.valueOf(nameValues[i]), String.valueOf(nameValues[i + 1]));
        }
        return new RuleMessage(code, params);
    }

    /** The text in Spanish; empty when there is no code. */
    public String spanish() {
        if (code == null) {
            return "";
        }
        String template = SPANISH.getProperty(code, code);
        Matcher m = PLACEHOLDER.matcher(template);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(out, Matcher.quoteReplacement(param(m.group(1))));
        }
        m.appendTail(out);
        return out.toString();
    }

    private String param(String name) {
        String value = params.getOrDefault(name, "");
        if (name.startsWith("level")) {
            return SPANISH.getProperty("level." + value, value);
        }
        if (name.equals("left") || name.equals("right")) {
            return SPANISH.getProperty("type." + value, value);
        }
        return value;
    }

    private static Properties load() {
        Properties p = new Properties();
        try (InputStream in = RuleMessage.class.getResourceAsStream(TEXTS)) {
            if (in != null) {
                p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return p;
    }
}
