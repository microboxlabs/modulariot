package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.core.api.HarnessClient;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleText;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.RuleDescription;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomSummary;
import com.microboxlabs.miot.symptoms.catalog.store.RuleDescriptionStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Plain-language descriptions of symptom rules for the owner. The Harness
 * writes each one once per section, rule text and source; later calls read
 * it from {@link RuleDescriptionStore}. Spacing changes in the rule do not
 * count as a new text.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class RuleDescriptionService {

    static final String AUDIENCE = "owner";
    static final String DEFAULT_LOCALE = "es-CL";
    static final int MAX_RULE_CHARS = 4_000;
    private static final Duration HARNESS_TIMEOUT = Duration.ofSeconds(20);

    /** Whole sections: several lines of text, not one CEL expression. */
    static final String LEVELS = "levels";
    static final String LIFECYCLE = "lifecycle";
    static final String ACTIVATION = "activation";
    /** The whole symptom: activation, measure, levels with their response, open and close. */
    static final String OVERVIEW = "overview";

    private static final Set<String> SECTIONS = Set.of(ACTIVATION, "measure", "levels.1", "levels.2",
            "levels.3", "levels.4", "lifecycle.open", "lifecycle.close", LEVELS, LIFECYCLE, OVERVIEW);
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern LOCALE = Pattern.compile("[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?");

    private static final Map<String, String> LEVEL_LABELS = Map.of(
            "medida", "valor medido",
            "sostenido_s", "segundos que lleva la condición");

    private static final Map<String, String> CASE_LABELS = Map.of(
            "caso.condicion_s", "segundos con la condición presente",
            "caso.normal_s", "segundos desde que volvió a la normalidad",
            "caso.edad_h", "horas desde que se abrió el caso",
            "caso.nivel", "nivel del caso",
            "caso.cerrado_por_operador", "el operador cerró el caso");

    /** Who is asking, forwarded to the Harness as on the chat proxy. */
    public record Caller(String authorization, String tenantClientId, String userEmail) {
        String authMode() {
            return userEmail != null ? "web" : "m2m";
        }
    }

    public record Description(String html, boolean cached) {
    }

    /** Sends the request body to the Harness and returns the description it wrote. */
    @FunctionalInterface
    public interface Writer {
        String write(Caller caller, Map<String, Object> body);
    }

    /** The Harness did not answer, answered with an error, or wrote nothing. */
    public static class UnavailableException extends RuntimeException {
        public UnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private final RuleDescriptionStore store;
    private final DataSourceService sources;
    private final Writer writer;

    @Inject
    public RuleDescriptionService(RuleDescriptionStore store, DataSourceService sources,
            @RestClient HarnessClient harness) {
        this(store, sources, (caller, body) -> {
            Map<String, Object> answer = harness.describe(caller.authorization(), caller.tenantClientId(),
                    caller.userEmail(), caller.authMode(), body).await().atMost(HARNESS_TIMEOUT);
            return answer == null || !(answer.get("html") instanceof String html) ? null : html;
        });
    }

    public RuleDescriptionService(RuleDescriptionStore store, DataSourceService sources, Writer writer) {
        this.store = store;
        this.sources = sources;
        this.writer = writer;
    }

    public Description describe(String tenantCode, String section, String rule, String sourceKey, String locale,
            Caller caller) {
        if (section == null || !SECTIONS.contains(section)) {
            throw new IllegalArgumentException("section must be one of " + String.join(", ", SECTIONS.stream()
                    .sorted().toList()));
        }
        if (rule == null || rule.isBlank()) {
            throw new IllegalArgumentException("rule is required");
        }
        if (rule.length() > MAX_RULE_CHARS) {
            throw new IllegalArgumentException("rule is longer than " + MAX_RULE_CHARS + " characters");
        }
        if (sourceKey == null || sourceKey.isBlank()) {
            throw new IllegalArgumentException("sourceKey is required");
        }
        String lang = locale == null || locale.isBlank() ? DEFAULT_LOCALE : locale.trim();
        if (!LOCALE.matcher(lang).matches()) {
            throw new IllegalArgumentException("locale must look like es-CL");
        }
        DataSource source = sources.find(tenantCode, sourceKey)
                .orElseThrow(() -> new NoSuchElementException("data source not found: " + sourceKey));

        String hash = hash(section, canonical(section, rule), sourceKey);
        var saved = store.find(hash, lang, AUDIENCE);
        if (saved.isPresent()) {
            return new Description(saved.get().html(), true);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("section", section);
        body.put("rule", rule.trim());
        body.put("fields", fields(section, source));
        body.put("locale", lang);
        String html;
        try {
            html = DescriptionHtml.sanitize(writer.write(caller, body));
        } catch (RuntimeException e) {
            throw new UnavailableException("The description service is not available right now.", e);
        }
        if (html.isBlank()) {
            throw new UnavailableException("The description service returned no text.", null);
        }
        store.save(new RuleDescription(hash, lang, AUDIENCE, html));
        return new Description(html, false);
    }

    /**
     * The summaries with the description already written for their activation, read in one lookup and without
     * calling the Harness. A spec without a source uses its definition's.
     */
    public List<SymptomSummary> withActivationTexts(List<SymptomSummary> summaries) {
        List<String> hashes = summaries.stream()
                .map(s -> activationHash(s.current() == null ? null : s.current().spec(),
                        s.definition().sourceKey()))
                .toList();
        Map<String, RuleDescription> found = store.findAll(
                hashes.stream().filter(Objects::nonNull).collect(Collectors.toSet()), DEFAULT_LOCALE, AUDIENCE);
        List<SymptomSummary> out = new ArrayList<>(summaries.size());
        for (int i = 0; i < summaries.size(); i++) {
            RuleDescription d = hashes.get(i) == null ? null : found.get(hashes.get(i));
            out.add(summaries.get(i).withActivationText(d == null ? null : d.html()));
        }
        return out;
    }

    /** The cache key of a spec's activation, or null when it has none to describe. */
    static String activationHash(SymptomSpec spec, String fallbackSource) {
        if (spec == null || spec.activation() == null || spec.activation().isBlank()
                || spec.activation().length() > MAX_RULE_CHARS) {
            return null;
        }
        String source = spec.source() == null || spec.source().isBlank() ? fallbackSource : spec.source();
        return source == null ? null : hash(ACTIVATION, canonical(ACTIVATION, spec.activation()), source);
    }

    /** Field path to label: the source's fields, plus the level or case variables for those sections; all for the overview. */
    static Map<String, String> fields(String section, DataSource source) {
        Map<String, String> out = new LinkedHashMap<>();
        if (section.equals(LIFECYCLE) || section.startsWith("lifecycle.")) {
            out.putAll(CASE_LABELS);
            return out;
        }
        for (SourceField f : source.fields() == null ? List.<SourceField>of() : source.fields()) {
            out.put(f.path(), f.label() == null || f.label().isBlank() ? f.path() : f.label());
        }
        if (section.equals(LEVELS) || section.startsWith("levels.") || section.equals(OVERVIEW)) {
            out.putAll(LEVEL_LABELS);
        }
        if (section.equals(OVERVIEW)) {
            out.putAll(CASE_LABELS);
        }
        return out;
    }

    /** The rule text used for the cache key. Whole sections are trimmed per line with spaces collapsed. */
    static String canonical(String section, String rule) {
        if (!section.equals(LEVELS) && !section.equals(LIFECYCLE) && !section.equals(OVERVIEW)) {
            return RuleText.canonical(rule);
        }
        return rule.lines()
                .map(line -> SPACES.matcher(line.strip()).replaceAll(" "))
                .filter(line -> !line.isEmpty())
                .collect(Collectors.joining("\n"));
    }

    static String hash(String section, String canonicalRule, String sourceKey) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((section + "\n" + canonicalRule + "\n" + sourceKey).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
