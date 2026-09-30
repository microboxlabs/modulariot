package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.microboxlabs.miot.core.mcp.NullableOutputSchemaGenerator;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import io.quarkiverse.mcp.server.Tool;
import io.smallrye.mutiny.Uni;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Array;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URL;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.jboss.jandex.AnnotationInstance;
import org.jboss.jandex.AnnotationValue;
import org.jboss.jandex.CompositeIndex;
import org.jboss.jandex.DotName;
import org.jboss.jandex.IndexReader;
import org.jboss.jandex.IndexView;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

/**
 * Every structured MCP tool result must validate against the output schema the
 * server advertises, nulls included: MCP clients reject results that do not.
 * Tools are found through the modules' Jandex indexes.
 */
class StructuredToolOutputSchemaTest {

    private static final DotName TOOL = DotName.createSimple(Tool.class);

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .findAndAddModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    // No customizers: the optional victools modules are not on the modulith's classpath.
    private static final NullableOutputSchemaGenerator GENERATOR = new NullableOutputSchemaGenerator(List.of(), MAPPER);

    private static final JsonSchemaFactory SCHEMAS = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);

    private static final Map<Class<?>, Supplier<Object>> SCALARS = Map.ofEntries(
            Map.entry(String.class, () -> "x"),
            Map.entry(Object.class, () -> "x"),
            Map.entry(UUID.class, () -> UUID.fromString("00000000-0000-0000-0000-000000000001")),
            Map.entry(Instant.class, () -> Instant.EPOCH),
            Map.entry(OffsetDateTime.class, () -> OffsetDateTime.parse("2026-01-01T00:00:00Z")),
            Map.entry(LocalDate.class, () -> LocalDate.of(2026, 1, 1)),
            Map.entry(URI.class, () -> URI.create("https://example.test/")),
            Map.entry(Boolean.class, () -> Boolean.TRUE),
            Map.entry(Integer.class, () -> 1),
            Map.entry(Long.class, () -> 1L),
            Map.entry(Double.class, () -> 1.5d),
            Map.entry(BigDecimal.class, () -> BigDecimal.ONE),
            Map.entry(JsonNode.class, () -> MAPPER.createObjectNode().put("k", "v")));

    private static final int MAX_DEPTH = 8;

    /** NULLS: containers and records filled, scalars null. EMPTY: every reference null. FILLED: no nulls. */
    enum Mode { NULLS, EMPTY, FILLED }

    record StructuredTool(String name, Type output) {
    }

    @Test
    void findsTheToolsOfEveryModule() throws IOException {
        List<String> names = structuredTools().stream().map(StructuredTool::name).toList();
        assertTrue(names.containsAll(List.of("selectables_list", "stories_create", "stories_list", "connections_list")),
                () -> "found only " + names);
    }

    @TestFactory
    Stream<DynamicTest> everyStructuredResultMatchesItsOutputSchema() throws IOException {
        return structuredTools().stream().flatMap(tool -> Stream.of(Mode.values()).map(mode ->
                DynamicTest.dynamicTest(tool.name() + " " + mode, () -> {
                    JsonNode schema = (JsonNode) GENERATOR.generate(tool.output());
                    JsonNode result = MAPPER.valueToTree(sample(tool.output(), mode, true, 0));
                    Set<ValidationMessage> errors = SCHEMAS.getSchema(schema).validate(result);
                    assertEquals(Set.of(), errors, () -> "result " + result + "\nschema " + schema);
                })));
    }

    private static List<StructuredTool> structuredTools() throws IOException {
        List<StructuredTool> tools = new ArrayList<>();
        for (AnnotationInstance a : index().getAnnotations(TOOL)) {
            AnnotationValue structured = a.value("structuredContent");
            if (structured == null || !structured.asBoolean()) {
                continue;
            }
            var target = a.target().asMethod();
            Method method = Stream.of(load(target.declaringClass().name().toString()).getDeclaredMethods())
                    .filter(m -> m.getName().equals(target.name()) && m.getParameterCount() == target.parametersCount())
                    .findFirst().orElseThrow();
            Type output = method.getGenericReturnType();
            if (output instanceof ParameterizedType p && p.getRawType() == Uni.class) {
                output = p.getActualTypeArguments()[0];
            }
            tools.add(new StructuredTool(a.value("name").asString(), output));
        }
        tools.sort((x, y) -> x.name().compareTo(y.name()));
        return tools;
    }

    private static IndexView index() throws IOException {
        List<IndexView> indexes = new ArrayList<>();
        for (URL url : Collections.list(
                StructuredToolOutputSchemaTest.class.getClassLoader().getResources("META-INF/jandex.idx"))) {
            try (InputStream in = url.openStream()) {
                indexes.add(new IndexReader(in).read());
            }
        }
        return CompositeIndex.create(indexes);
    }

    private static Class<?> load(String name) {
        try {
            return Class.forName(name, false, StructuredToolOutputSchemaTest.class.getClassLoader());
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Object sample(Type type, Mode mode, boolean top, int depth) throws ReflectiveOperationException {
        Class<?> raw = type instanceof ParameterizedType p ? (Class<?>) p.getRawType() : (Class<?>) type;
        if (raw.isPrimitive()) {
            return Array.get(Array.newInstance(raw, 1), 0);
        }
        boolean scalar = raw.isEnum() || SCALARS.containsKey(raw);
        // The cap only stops self-referencing types; real results nest up to seven levels
        // (symptoms_get: detail > versions > version > spec > levels > level > response).
        if ((mode == Mode.EMPTY && !top) || (mode == Mode.NULLS && scalar) || depth > MAX_DEPTH) {
            return null;
        }
        if (raw.isEnum()) {
            return raw.getEnumConstants()[0];
        }
        if (scalar) {
            return SCALARS.get(raw).get();
        }
        Type[] args = type instanceof ParameterizedType p ? p.getActualTypeArguments() : new Type[0];
        if (Collection.class.isAssignableFrom(raw)) {
            List<Object> list = new ArrayList<>();
            list.add(sample(args[0], element(args[0], mode), false, depth + 1));
            return list;
        }
        if (Map.class.isAssignableFrom(raw)) {
            Map<Object, Object> map = new LinkedHashMap<>();
            map.put("k", sample(args[1], element(args[1], mode), false, depth + 1));
            return map;
        }
        if (raw.isRecord()) {
            RecordComponent[] components = raw.getRecordComponents();
            Object[] values = new Object[components.length];
            Class<?>[] types = new Class<?>[components.length];
            for (int i = 0; i < components.length; i++) {
                values[i] = sample(components[i].getGenericType(), mode, false, depth + 1);
                types[i] = components[i].getType();
            }
            return raw.getDeclaredConstructor(types).newInstance(values);
        }
        throw new AssertionError("No sample for " + type + "; add it to SCALARS");
    }

    // Collection items and map values are never null in a result.
    private static Mode element(Type type, Mode mode) {
        Class<?> raw = type instanceof ParameterizedType p ? (Class<?>) p.getRawType() : (Class<?>) type;
        return mode == Mode.NULLS && (raw.isEnum() || SCALARS.containsKey(raw)) ? Mode.FILLED : mode;
    }
}
