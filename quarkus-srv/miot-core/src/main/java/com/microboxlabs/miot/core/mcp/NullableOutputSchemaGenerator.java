package com.microboxlabs.miot.core.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.victools.jsonschema.generator.Option;
import com.github.victools.jsonschema.generator.OptionPreset;
import com.github.victools.jsonschema.generator.SchemaGenerator;
import com.github.victools.jsonschema.generator.SchemaGeneratorConfigBuilder;
import com.github.victools.jsonschema.generator.SchemaVersion;
import io.quarkiverse.mcp.server.GlobalOutputSchemaGenerator;
import io.quarkiverse.mcp.server.runtime.SchemaGeneratorConfigCustomizer;
import io.quarkus.arc.All;
import jakarta.inject.Singleton;
import java.lang.reflect.Type;
import java.util.List;

/**
 * Output schemas for structured tool results. Same settings as the
 * extension's default generator, except that non-primitive fields may be
 * {@code null}: results are serialized with their nulls, and clients that
 * validate structured content reject a null against a plain
 * {@code "type": "string"}. Input schemas keep the default generator.
 */
@Singleton
public class NullableOutputSchemaGenerator implements GlobalOutputSchemaGenerator {

    private final SchemaGenerator generator;

    public NullableOutputSchemaGenerator(@All List<SchemaGeneratorConfigCustomizer> customizers,
            ObjectMapper objectMapper) {
        var builder = new SchemaGeneratorConfigBuilder(objectMapper, SchemaVersion.DRAFT_2020_12,
                OptionPreset.PLAIN_JSON)
                .without(Option.SCHEMA_VERSION_INDICATOR)
                .with(Option.NULLABLE_FIELDS_BY_DEFAULT);
        customizers.forEach(c -> c.customize(builder));
        this.generator = new SchemaGenerator(builder.build());
    }

    @Override
    public Object generate(Type from) {
        return generator.generateSchema(from);
    }
}
