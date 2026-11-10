package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.ConvTemplate.Teams;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Draws a template's {@link Teams} card as the body a Teams Workflows webhook takes: a {@code message} with one
 * Adaptive Card. Each text is rendered with the event's variables and trimmed; an empty part is left out.
 *
 * <ul>
 *   <li>title: a heading;</li>
 *   <li>subtitle and caption: a bold line and a grey line under it;</li>
 *   <li>text: the message;</li>
 *   <li>images: a label and the image for each {@code {name, url}} in the data field whose URL is https;</li>
 *   <li>facts: one fact set; an optional fact whose value is empty or {@code -} is left out;</li>
 *   <li>notes: a blank line, then each note in grey;</li>
 *   <li>actions: an Open URL button each, when its URL is http or https.</li>
 * </ul>
 */
public final class TeamsCard {

    /** A fact whose value is this, or empty, has no value. */
    static final String NO_VALUE = "-";
    private static final String TYPE = "type";
    private static final String TEXT = "text";
    private static final String WRAP = "wrap";
    private static final String TEXT_BLOCK = "TextBlock";
    private static final String SPACING = "spacing";
    private static final String NONE = "None";
    private static final String SUBTLE = "isSubtle";
    private static final String WEIGHT = "weight";
    private static final String BOLDER = "Bolder";
    private static final String TITLE = "title";

    private TeamsCard() {
    }

    /** The request body: {@code {"type": "message", "attachments": [card]}}. */
    public static Map<String, Object> body(Teams card, Map<String, String> vars, Map<String, Object> data) {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("$schema", ConnectionChannel.CARD_SCHEMA);
        content.put(TYPE, "AdaptiveCard");
        content.put("version", ConnectionChannel.CARD_VERSION);
        content.put("body", blocks(card, vars, data));
        List<Map<String, Object>> actions = actions(card, vars);
        if (!actions.isEmpty()) {
            content.put("actions", actions);
        }
        Map<String, Object> attachment = new LinkedHashMap<>();
        attachment.put("contentType", ConnectionChannel.CARD_CONTENT_TYPE);
        attachment.put("content", content);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(TYPE, "message");
        out.put("attachments", List.of(attachment));
        return out;
    }

    /** The title, rendered: what the inbox stores as the message's subject; null without one. */
    public static String subject(Teams card, Map<String, String> vars) {
        String title = render(card.title(), vars);
        return title.isEmpty() ? null : title;
    }

    /** The text, rendered. */
    public static String text(Teams card, Map<String, String> vars) {
        String text = render(card.text(), vars);
        return text.isEmpty() ? null : text;
    }

    /** What is wrong with the card, for the template's save; empty when it can be drawn. */
    public static List<String> problems(Teams card) {
        List<String> out = new ArrayList<>();
        if (blank(card.title()) && blank(card.text())) {
            out.add("teams needs a title or a text");
        }
        if (card.images() != null && blank(card.images().field())) {
            out.add("teams.images.field is required");
        }
        for (Teams.Fact f : card.facts()) {
            if (blank(f.title())) {
                out.add("each teams fact needs a title");
                break;
            }
        }
        for (Teams.Action a : card.actions()) {
            if (blank(a.title()) || blank(a.url())) {
                out.add("each teams action needs a title and a url");
                break;
            }
        }
        return out;
    }

    /** The variables of the card's texts. */
    static List<String> texts(Teams card) {
        List<String> out = new ArrayList<>();
        out.add(card.title());
        out.add(card.subtitle());
        out.add(card.caption());
        out.add(card.text());
        if (card.images() != null) {
            out.add(card.images().label());
        }
        card.facts().forEach(f -> {
            out.add(f.title());
            out.add(f.value());
        });
        out.addAll(card.notes());
        card.actions().forEach(a -> {
            out.add(a.title());
            out.add(a.url());
        });
        return out;
    }

    private static List<Map<String, Object>> blocks(Teams card, Map<String, String> vars, Map<String, Object> data) {
        List<Map<String, Object>> out = new ArrayList<>();
        String title = render(card.title(), vars);
        if (!title.isEmpty()) {
            Map<String, Object> heading = textBlock(title);
            heading.put("size", "Medium");
            heading.put(WEIGHT, BOLDER);
            heading.put("style", "heading");
            out.add(reorder(heading, TYPE, "size", WEIGHT, TEXT, "style", WRAP));
        }
        List<Map<String, Object>> byline = new ArrayList<>();
        String subtitle = render(card.subtitle(), vars);
        if (!subtitle.isEmpty()) {
            Map<String, Object> b = textBlock(subtitle);
            b.put(WEIGHT, BOLDER);
            byline.add(reorder(b, TYPE, WEIGHT, TEXT, WRAP));
        }
        String caption = render(card.caption(), vars);
        if (!caption.isEmpty()) {
            byline.add(subtle(caption));
        }
        if (!byline.isEmpty()) {
            out.add(columnSet(byline));
        }
        String text = render(card.text(), vars);
        if (!text.isEmpty()) {
            out.add(textBlock(text));
        }
        List<Map<String, Object>> images = images(card.images(), vars, data);
        if (!images.isEmpty()) {
            out.add(columnSet(images));
        }
        List<Map<String, Object>> facts = facts(card, vars);
        if (!facts.isEmpty()) {
            Map<String, Object> set = new LinkedHashMap<>();
            set.put(TYPE, "FactSet");
            set.put("facts", facts);
            out.add(set);
        }
        List<Map<String, Object>> notes = new ArrayList<>();
        for (String note : card.notes()) {
            String n = render(note, vars);
            if (!n.isEmpty()) {
                notes.add(subtle(n));
            }
        }
        if (!notes.isEmpty()) {
            Map<String, Object> blank = new LinkedHashMap<>();
            blank.put(TYPE, TEXT_BLOCK);
            blank.put(TEXT, " ");
            out.add(blank);
            out.addAll(notes);
        }
        return out;
    }

    private static List<Map<String, Object>> images(Teams.Images images, Map<String, String> vars,
            Map<String, Object> data) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (images == null || images.field() == null || data == null
                || !(data.get(images.field()) instanceof List<?> list)) {
            return out;
        }
        int n = 0;
        for (Object item : list) {
            String url = item instanceof Map<?, ?> m && m.get("url") != null ? String.valueOf(m.get("url")).strip()
                    : "";
            if (!url.regionMatches(true, 0, "https://", 0, 8)) {
                continue;
            }
            n++;
            Object rawName = ((Map<?, ?>) item).get("name");
            String name = rawName == null ? "" : String.valueOf(rawName);
            Map<String, String> itemVars = new LinkedHashMap<>(vars);
            itemVars.put("n", String.valueOf(n));
            itemVars.put("name", name);
            itemVars.put("url", url);
            String label = render(images.label(), itemVars);
            if (!label.isEmpty()) {
                out.add(textBlock(label));
            }
            Map<String, Object> image = new LinkedHashMap<>();
            image.put(TYPE, "Image");
            image.put("style", "Default");
            image.put("url", url);
            image.put("altText", name);
            image.put("size", "Auto");
            out.add(image);
        }
        return out;
    }

    private static List<Map<String, Object>> facts(Teams card, Map<String, String> vars) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Teams.Fact f : card.facts()) {
            String value = render(f.value(), vars);
            if (f.optional() && (value.isEmpty() || NO_VALUE.equals(value))) {
                continue;
            }
            Map<String, Object> fact = new LinkedHashMap<>();
            fact.put(TITLE, render(f.title(), vars));
            fact.put("value", value);
            out.add(fact);
        }
        return out;
    }

    private static List<Map<String, Object>> actions(Teams card, Map<String, String> vars) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Teams.Action a : card.actions()) {
            String url = render(a.url(), vars);
            if (!url.regionMatches(true, 0, "https://", 0, 8) && !url.regionMatches(true, 0, "http://", 0, 7)) {
                continue;
            }
            Map<String, Object> action = new LinkedHashMap<>();
            action.put(TYPE, "Action.OpenUrl");
            action.put(TITLE, render(a.title(), vars));
            action.put("url", url);
            out.add(action);
        }
        return out;
    }

    private static Map<String, Object> columnSet(List<Map<String, Object>> items) {
        Map<String, Object> column = new LinkedHashMap<>();
        column.put(TYPE, "Column");
        column.put("items", items);
        column.put("width", "stretch");
        Map<String, Object> set = new LinkedHashMap<>();
        set.put(TYPE, "ColumnSet");
        set.put("columns", List.of(column));
        return set;
    }

    private static Map<String, Object> textBlock(String text) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put(TYPE, TEXT_BLOCK);
        b.put(TEXT, text);
        b.put(WRAP, true);
        return b;
    }

    private static Map<String, Object> subtle(String text) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put(TYPE, TEXT_BLOCK);
        b.put(SPACING, NONE);
        b.put(TEXT, text);
        b.put(SUBTLE, true);
        b.put(WRAP, true);
        return b;
    }

    /** The same entries in this key order, for a stable body. */
    private static Map<String, Object> reorder(Map<String, Object> in, String... keys) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : keys) {
            if (in.containsKey(k)) {
                out.put(k, in.get(k));
            }
        }
        in.forEach(out::putIfAbsent);
        return out;
    }

    private static String render(String text, Map<String, String> vars) {
        String r = TemplateVariables.render(text, vars);
        return r == null ? "" : r.strip();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
