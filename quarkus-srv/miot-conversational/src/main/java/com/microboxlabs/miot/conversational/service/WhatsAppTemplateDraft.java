package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.service.WhatsAppTemplate.Button;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * A template to submit to Meta: a text header, a body with NAMED parameters ({@code {{name}}}), a footer,
 * buttons, and an example for every parameter. {@link #validate()} applies Meta's rules the app can check
 * before the call, so most mistakes come back as a clear 400 instead of Meta's error codes.
 */
public record WhatsAppTemplateDraft(
        String name,
        String language,
        String category,
        String header,
        String body,
        String footer,
        List<Button> buttons,
        Map<String, String> examples) {

    public static final String DEFAULT_LANGUAGE = "es_CL";
    static final Set<String> CATEGORIES = Set.of("UTILITY", "MARKETING");
    static final int BODY_MAX = 1024;
    static final int HEADER_MAX = 60;
    static final int FOOTER_MAX = 60;
    static final int BUTTONS_MAX = 10;
    static final int BUTTON_TEXT_MAX = 25;
    static final int URL_BUTTONS_MAX = 2;
    static final int PHONE_BUTTONS_MAX = 1;
    static final int URL_MAX = 2000;
    private static final Pattern NAME = Pattern.compile("[a-z0-9_]{1,512}");
    private static final Pattern LANGUAGE = Pattern.compile("[a-z]{2,3}(_[A-Z]{2})?");
    private static final Pattern PARAM_NAME = Pattern.compile("[a-z][a-z0-9_]*");
    private static final Pattern URL = Pattern.compile("https?://\\S+");
    private static final Pattern PHONE = Pattern.compile("\\+[1-9]\\d{6,14}");
    private static final String QUICK_REPLY = "QUICK_REPLY";
    private static final String URL_TYPE = "URL";
    private static final String PHONE_NUMBER = "PHONE_NUMBER";

    public String languageOrDefault() {
        return language == null || language.isBlank() ? DEFAULT_LANGUAGE : language.trim();
    }

    public String categoryUpper() {
        return category == null ? null : category.trim().toUpperCase(Locale.ROOT);
    }

    /** Checks the name and language too: they are fixed after creation, so an edit checks only the rest. */
    public void validateNew() {
        if (name == null || !NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("name: lowercase letters, digits and underscores only");
        }
        if (!LANGUAGE.matcher(languageOrDefault()).matches()) {
            throw new IllegalArgumentException("language: a code such as es_CL or en_US");
        }
        validate();
    }

    /** @throws IllegalArgumentException naming the first rule the draft breaks */
    public void validate() {
        if ("AUTHENTICATION".equals(categoryUpper())) {
            throw new IllegalArgumentException(
                    "category: AUTHENTICATION templates use Meta's one-time code layout; create them in Meta");
        }
        if (!CATEGORIES.contains(categoryUpper())) {
            throw new IllegalArgumentException("category: UTILITY or MARKETING");
        }
        if (isBlank(body)) {
            throw new IllegalArgumentException("body is required");
        }
        if (body.length() > BODY_MAX) {
            throw new IllegalArgumentException("body: at most " + BODY_MAX + " characters");
        }
        String trimmed = body.trim();
        if (trimmed.startsWith("{{") || trimmed.endsWith("}}")) {
            throw new IllegalArgumentException("body: Meta does not accept a parameter at the start or the end");
        }
        checkParams("body", body);
        if (!isBlank(header)) {
            if (header.length() > HEADER_MAX) {
                throw new IllegalArgumentException("header: at most " + HEADER_MAX + " characters");
            }
            if (WhatsAppTemplate.paramsOf(header).size() > 1) {
                throw new IllegalArgumentException("header: at most one parameter");
            }
            checkParams("header", header);
        }
        if (!isBlank(footer)) {
            if (footer.length() > FOOTER_MAX) {
                throw new IllegalArgumentException("footer: at most " + FOOTER_MAX + " characters");
            }
            if (!WhatsAppTemplate.paramsOf(footer).isEmpty()) {
                throw new IllegalArgumentException("footer: parameters are not allowed");
            }
        }
        validateButtons();
    }

    private void checkParams(String part, String text) {
        for (String p : WhatsAppTemplate.paramsOf(text)) {
            if (!PARAM_NAME.matcher(p).matches()) {
                throw new IllegalArgumentException(part + ": parameter {{" + p
                        + "}} must be lowercase letters, digits and underscores, starting with a letter");
            }
            String example = examples == null ? null : examples.get(p);
            if (isBlank(example)) {
                throw new IllegalArgumentException(part + ": parameter {{" + p + "}} needs an example");
            }
        }
    }

    private void validateButtons() {
        List<Button> list = buttons == null ? List.of() : buttons;
        if (list.size() > BUTTONS_MAX) {
            throw new IllegalArgumentException("buttons: at most " + BUTTONS_MAX);
        }
        int urls = 0;
        int phones = 0;
        int groups = 0;
        Boolean lastQuickReply = null;
        for (int i = 0; i < list.size(); i++) {
            Button b = list.get(i);
            String type = b == null || b.type() == null ? "" : b.type().toUpperCase(Locale.ROOT);
            String label = "buttons[" + (i + 1) + "]";
            if (isBlank(b == null ? null : b.text()) || b.text().length() > BUTTON_TEXT_MAX) {
                throw new IllegalArgumentException(label + ": text of 1 to " + BUTTON_TEXT_MAX + " characters");
            }
            switch (type) {
                case QUICK_REPLY -> {
                    // Text only.
                }
                case URL_TYPE -> {
                    urls++;
                    if (b.url() == null || !URL.matcher(b.url()).matches() || b.url().length() > URL_MAX
                            || b.url().contains("{{")) {
                        throw new IllegalArgumentException(label + ": a fixed http or https address");
                    }
                }
                case PHONE_NUMBER -> {
                    phones++;
                    if (b.phoneNumber() == null || !PHONE.matcher(b.phoneNumber()).matches()) {
                        throw new IllegalArgumentException(label + ": a phone number such as +15550000000");
                    }
                }
                default -> throw new IllegalArgumentException(label + ": QUICK_REPLY, URL or PHONE_NUMBER");
            }
            boolean quickReply = QUICK_REPLY.equals(type);
            if (lastQuickReply == null || lastQuickReply != quickReply) {
                groups++;
                lastQuickReply = quickReply;
            }
        }
        if (urls > URL_BUTTONS_MAX) {
            throw new IllegalArgumentException("buttons: at most " + URL_BUTTONS_MAX + " URL buttons");
        }
        if (phones > PHONE_BUTTONS_MAX) {
            throw new IllegalArgumentException("buttons: at most " + PHONE_BUTTONS_MAX + " phone button");
        }
        if (groups > 2) {
            throw new IllegalArgumentException("buttons: keep the quick replies together, before or after the links");
        }
    }

    /** The create payload: name, language, category, NAMED parameters and the components. */
    public JsonObject toCreate() {
        return new JsonObject()
                .put("name", name)
                .put("language", languageOrDefault())
                .put("category", categoryUpper())
                .put("parameter_format", "NAMED")
                .put("components", components());
    }

    /** The edit payload: Meta keeps the name and language; the category and components may change. */
    public JsonObject toEdit() {
        return new JsonObject().put("category", categoryUpper()).put("components", components());
    }

    JsonArray components() {
        JsonArray out = new JsonArray();
        if (!isBlank(header)) {
            JsonObject h = new JsonObject().put("type", "HEADER").put("format", "TEXT").put("text", header.trim());
            JsonArray named = named(header);
            if (!named.isEmpty()) {
                h.put("example", new JsonObject().put("header_text_named_params", named));
            }
            out.add(h);
        }
        JsonObject b = new JsonObject().put("type", "BODY").put("text", body);
        JsonArray named = named(body);
        if (!named.isEmpty()) {
            b.put("example", new JsonObject().put("body_text_named_params", named));
        }
        out.add(b);
        if (!isBlank(footer)) {
            out.add(new JsonObject().put("type", "FOOTER").put("text", footer.trim()));
        }
        if (buttons != null && !buttons.isEmpty()) {
            JsonArray list = new JsonArray();
            for (Button button : buttons) {
                String type = button.type().toUpperCase(Locale.ROOT);
                JsonObject j = new JsonObject().put("type", type).put("text", button.text().trim());
                if (URL_TYPE.equals(type)) {
                    j.put("url", button.url());
                } else if (PHONE_NUMBER.equals(type)) {
                    j.put("phone_number", button.phoneNumber());
                }
                list.add(j);
            }
            out.add(new JsonObject().put("type", "BUTTONS").put("buttons", list));
        }
        return out;
    }

    private JsonArray named(String text) {
        JsonArray out = new JsonArray();
        for (String p : WhatsAppTemplate.paramsOf(text)) {
            out.add(new JsonObject().put("param_name", p).put("example", examples.get(p).trim()));
        }
        return out;
    }

    /** What the app shows right after a submit, before the list is read again. */
    public WhatsAppTemplate toTemplate(String id, String status) {
        List<String> exampleNames = new ArrayList<>(WhatsAppTemplate.paramsOf(header));
        exampleNames.addAll(WhatsAppTemplate.paramsOf(body));
        Map<String, String> ex = new LinkedHashMap<>();
        for (String p : exampleNames) {
            ex.put(p, examples.get(p));
        }
        return new WhatsAppTemplate(id, name, languageOrDefault(), categoryUpper(), status, null, "NAMED",
                isBlank(header) ? null : "TEXT", isBlank(header) ? null : header.trim(), body,
                isBlank(footer) ? null : footer.trim(), buttons == null ? List.of() : List.copyOf(buttons),
                WhatsAppTemplate.paramsOf(body), ex);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
