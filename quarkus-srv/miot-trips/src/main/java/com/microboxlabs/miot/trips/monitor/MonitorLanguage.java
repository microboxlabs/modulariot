package com.microboxlabs.miot.trips.monitor;

import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import dev.cel.bundle.Cel;
import dev.cel.bundle.CelFactory;
import dev.cel.common.CelFunctionDecl;
import dev.cel.common.CelIssue;
import dev.cel.common.CelOptions;
import dev.cel.common.CelOverloadDecl;
import dev.cel.common.CelValidationException;
import dev.cel.common.CelValidationResult;
import dev.cel.common.types.CelType;
import dev.cel.common.types.CelTypeProvider;
import dev.cel.common.types.ListType;
import dev.cel.common.types.SimpleType;
import dev.cel.common.types.StructType;
import dev.cel.common.types.StructTypeReference;
import dev.cel.extensions.CelOptionalLibrary;
import dev.cel.parser.CelStandardMacro;
import dev.cel.runtime.CelEvaluationException;
import dev.cel.runtime.CelFunctionBinding;
import dev.cel.runtime.CelRuntime;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Checks and evaluates the CEL expressions of trip monitors against a {@link MonitorSchema}. Unknown fields and wrong
 * types are rejected on save. Times are CEL timestamps; {@code minutes(n)} and {@code hours(n)} give durations, so a
 * timer reads {@code trip.plannedStart + minutes(params.lateDepartureMinutes)}. A field the trip does not have yet
 * is absent: test it with {@code has(trip.actualStart)}.
 */
public final class MonitorLanguage {

    /** What an expression must produce. */
    public enum Expect {
        CONDITION,
        TIME
    }

    /** One problem, at a zero-based character offset. */
    public record Issue(int position, String message) {
    }

    /** The result type when it compiles, or its issues. */
    public record Check(boolean ok, String resultType, List<Issue> issues) {

        static Check passed(String type) {
            return new Check(true, type, List.of());
        }

        static Check failed(int position, String message) {
            return new Check(false, null, List.of(new Issue(position, message)));
        }
    }

    /** A value, or why the evaluation failed. */
    public record Result(Object value, String error) {

        public boolean ok() {
            return error == null;
        }
    }

    /** A compiled expression. */
    @FunctionalInterface
    public interface Prepared {
        Result run(Map<String, Object> context);
    }

    private static final CelOptions OPTIONS = CelOptions.current()
            .enableHeterogeneousNumericComparisons(true)
            .evaluateCanonicalTypesToNativeValues(true)
            .enableTimestampEpoch(true)
            .build();

    private static final int MAX_COMPILERS = 256;

    private static final Map<MonitorSchema, Cel> COMPILERS = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<MonitorSchema, Cel> eldest) {
            return size() > MAX_COMPILERS;
        }
    };

    private MonitorLanguage() {
    }

    public static Check check(MonitorSchema schema, String expression, Expect expect) {
        if (expression == null || expression.isBlank()) {
            return Check.failed(0, "the expression is empty");
        }
        CelValidationResult result = cel(schema).compile(expression);
        if (result.hasError()) {
            List<Issue> issues = result.getAllIssues().stream()
                    .filter(i -> i.getSeverity() == CelIssue.Severity.ERROR)
                    .map(i -> new Issue(offset(expression, i), i.getMessage()))
                    .toList();
            return new Check(false, null, issues);
        }
        CelType type;
        try {
            type = result.getAst().getResultType();
        } catch (CelValidationException e) {
            throw new IllegalStateException(e);
        }
        if (expect == Expect.CONDITION && type != SimpleType.BOOL && type != SimpleType.DYN) {
            return Check.failed(0, "the expression must give true or false, not " + type.name());
        }
        if (expect == Expect.TIME && type != SimpleType.TIMESTAMP && type != SimpleType.DYN) {
            return Check.failed(0, "the expression must give a time, not " + type.name());
        }
        return Check.passed(type.name());
    }

    /** Compiles once, to run on many contexts. The expression must pass {@link #check} first. */
    public static Prepared prepare(MonitorSchema schema, String expression) {
        Cel cel = cel(schema);
        CelValidationResult result = cel.compile(expression == null ? "" : expression);
        if (result.hasError()) {
            String error = result.getAllIssues().get(0).getMessage();
            return context -> new Result(null, error);
        }
        try {
            CelRuntime.Program program = cel.createProgram(result.getAst());
            return context -> {
                try {
                    return new Result(program.eval(doubles(context)), null);
                } catch (CelEvaluationException e) {
                    return new Result(null, e.getMessage());
                }
            };
        } catch (CelEvaluationException | CelValidationException e) {
            return context -> new Result(null, e.getMessage());
        }
    }

    /** True when evaluation failed only because the context has no value at a path the schema declares. */
    public static boolean missingValue(String error) {
        return error != null && (error.contains("is not present") || error.contains("No such key"));
    }

    public static Result evaluate(MonitorSchema schema, String expression, Map<String, Object> context) {
        return prepare(schema, expression).run(context);
    }

    /** Numbers are doubles in the schema, so whole numbers in a context are converted. */
    @SuppressWarnings("unchecked")
    static Object doubles(Object value) {
        return switch (value) {
            case Map<?, ?> m -> {
                Map<String, Object> out = new LinkedHashMap<>();
                ((Map<String, Object>) m).forEach((k, v) -> out.put(k, doubles(v)));
                yield out;
            }
            case List<?> l -> l.stream().map(MonitorLanguage::doubles).toList();
            case Double d -> d;
            case Number n -> n.doubleValue();
            case null, default -> value;
        };
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> doubles(Map<String, Object> context) {
        return (Map<String, Object>) doubles((Object) context);
    }

    static int offset(String expression, CelIssue issue) {
        int line = issue.getSourceLocation().getLine();
        int column = Math.max(0, issue.getSourceLocation().getColumn());
        int offset = 0;
        for (int i = 1; i < line; i++) {
            int newline = expression.indexOf('\n', offset);
            if (newline < 0) {
                break;
            }
            offset = newline + 1;
        }
        return Math.min(expression.length(), offset + column);
    }

    private static Cel cel(MonitorSchema schema) {
        synchronized (COMPILERS) {
            return COMPILERS.computeIfAbsent(schema, MonitorLanguage::build);
        }
    }

    private static Cel build(MonitorSchema schema) {
        Map<String, Map<String, CelType>> structs = new LinkedHashMap<>();
        Map<String, CelType> roots = new LinkedHashMap<>();
        schema.fields().forEach((path, type) -> {
            String[] parts = path.split("\\.");
            String root = parts[0];
            roots.putIfAbsent(bare(root), child(root));
            StringBuilder parent = new StringBuilder(root);
            for (int i = 1; i < parts.length; i++) {
                String parentType = typeName(parent.toString());
                structs.computeIfAbsent(parentType, k -> new LinkedHashMap<>());
                parent.append('.').append(parts[i]);
                CelType field = i == parts.length - 1 ? scalar(type) : child(parent.toString());
                structs.get(parentType).putIfAbsent(bare(parts[i]), field);
            }
        });
        List<CelType> types = new ArrayList<>();
        structs.forEach((name, fields) -> types.add(StructType.create(name, ImmutableSet.copyOf(fields.keySet()),
                f -> Optional.ofNullable(fields.get(f)))));
        ImmutableList<CelType> all = ImmutableList.copyOf(types);
        var builder = CelFactory.standardCelBuilder()
                .setOptions(OPTIONS)
                .setStandardMacros(CelStandardMacro.STANDARD_MACROS)
                .addCompilerLibraries(CelOptionalLibrary.INSTANCE)
                .addRuntimeLibraries(CelOptionalLibrary.INSTANCE)
                .setTypeProvider(new CelTypeProvider() {
                    @Override
                    public ImmutableCollection<CelType> types() {
                        return all;
                    }

                    @Override
                    public Optional<CelType> findType(String name) {
                        return all.stream().filter(t -> t.name().equals(name)).findFirst();
                    }
                })
                .addFunctionDeclarations(
                        CelFunctionDecl.newFunctionDeclaration("minutes", CelOverloadDecl.newGlobalOverload(
                                "minutes_double", SimpleType.DURATION, SimpleType.DOUBLE)),
                        CelFunctionDecl.newFunctionDeclaration("hours", CelOverloadDecl.newGlobalOverload(
                                "hours_double", SimpleType.DURATION, SimpleType.DOUBLE)))
                .addFunctionBindings(
                        CelFunctionBinding.from("minutes_double", Double.class,
                                m -> Duration.ofMillis(Math.round(m * 60_000))),
                        CelFunctionBinding.from("hours_double", Double.class,
                                h -> Duration.ofMillis(Math.round(h * 3_600_000))));
        roots.forEach(builder::addVar);
        for (String dynamic : MonitorSchema.DYNAMIC) {
            builder.addVar(dynamic, SimpleType.DYN);
        }
        return builder.build();
    }

    /** The type of an object path: a struct, or a list of structs when it ends in {@code []}. */
    private static CelType child(String path) {
        CelType struct = StructTypeReference.create(typeName(path));
        return path.endsWith("[]") ? ListType.create(struct) : struct;
    }

    private static String bare(String segment) {
        return segment.endsWith("[]") ? segment.substring(0, segment.length() - 2) : segment;
    }

    /** One CEL type per object path; each segment is length-prefixed so {@code a.b_c} and {@code a.b.c} differ. */
    static String typeName(String path) {
        StringBuilder name = new StringBuilder("T");
        for (String segment : path.split("\\.")) {
            String s = bare(segment) + (segment.endsWith("[]") ? "_list" : "");
            name.append('_').append(s.length()).append(s);
        }
        return name.toString();
    }

    static CelType scalar(String type) {
        return switch (type == null ? "" : type) {
            case MonitorSchema.NUMBER -> SimpleType.DOUBLE;
            case MonitorSchema.BOOL -> SimpleType.BOOL;
            case MonitorSchema.TIME -> SimpleType.TIMESTAMP;
            case MonitorSchema.ANY -> SimpleType.DYN;
            default -> SimpleType.STRING;
        };
    }
}
