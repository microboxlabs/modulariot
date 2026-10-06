package com.microboxlabs.miot.symptoms.catalog.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.NoSuchElementException;

/** The platform templates in {@value #RESOURCE}, the same for every organization. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TemplateService {

    static final String RESOURCE = "/symptoms/platform-templates.json";

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final List<SymptomTemplate> templates = load();

    public List<SymptomTemplate> list() {
        return templates;
    }

    public SymptomTemplate get(String key) {
        return templates.stream()
                .filter(t -> t.key().equals(key))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("template not found: " + key));
    }

    static List<SymptomTemplate> load() {
        try (InputStream in = TemplateService.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("missing " + RESOURCE);
            }
            return List.copyOf(JSON.readValue(in, new TypeReference<List<SymptomTemplate>>() {
            }));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
