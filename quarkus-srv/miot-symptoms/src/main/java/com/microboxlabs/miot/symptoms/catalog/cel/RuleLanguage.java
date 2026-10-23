package com.microboxlabs.miot.symptoms.catalog.cel;

import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import dev.cel.bundle.Cel;
import dev.cel.bundle.CelFactory;
import dev.cel.common.CelIssue;
import dev.cel.common.CelOptions;
import dev.cel.common.CelValidationException;
import dev.cel.common.CelValidationResult;
import dev.cel.common.types.CelType;
import dev.cel.common.types.CelTypeProvider;
import dev.cel.common.types.OptionalType;
import dev.cel.common.types.SimpleType;
import dev.cel.common.types.StructType;
import dev.cel.common.types.StructTypeReference;
import dev.cel.extensions.CelOptionalLibrary;
import dev.cel.parser.CelStandardMacro;
import dev.cel.runtime.CelEvaluationException;
import dev.cel.runtime.CelRuntime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Checks and evaluates symptom rules written in CEL. The schema's field
 * types become CEL types, so unknown fields and wrong types are rejected
 * before a rule runs. A field the source may leave out is read with
 * {@code .?}, which gives an optional, and compared with {@link #CONSTANTS}:
 * {@code signal.frame.?sensors.?panic_button == TRUE}. {@code has()} also
 * tests an optional field. Messages are in Spanish, for the symptom owner.
 */
public final class RuleLanguage {

    /** What a rule must produce. */
    public enum Expect {
        CONDITION,
        NUMBER
    }

    private static final CelOptions OPTIONS = CelOptions.current()
            .enableHeterogeneousNumericComparisons(true)
            .build();

    /** Optional values every rule can compare a {@code .?} read with. */
    public static final Map<String, Object> CONSTANTS = Map.of(
            "NONE", Optional.empty(),
            "TRUE", Optional.of(true),
            "FALSE", Optional.of(false));

    private static final int MAX_COMPILERS = 256;

    /** Compilers per schema, least recently used dropped first, so edited schemas do not accumulate. */
    private static final Map<RuleSchema, Cel> COMPILERS = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<RuleSchema, Cel> eldest) {
            return size() > MAX_COMPILERS;
        }
    };

    private RuleLanguage() {
    }

    public static RuleCheck check(RuleSchema schema, String expression, Expect expect) {
        if (expression == null || expression.isBlank()) {
            return RuleCheck.failed(new RuleIssue(0, RuleMessage.of("ruleEmpty"), ""));
        }
        Compiled compiled = compile(cel(schema), expression);
        CelValidationResult result = compiled.result();
        if (result.hasError()) {
            EqualityLiterals literals = compiled.literals();
            List<RuleIssue> issues = result.getAllIssues().stream()
                    .filter(issue -> issue.getSeverity() == CelIssue.Severity.ERROR)
                    .map(issue -> new RuleIssue(literals.original(offset(literals.text(), issue)),
                            RuleMessages.plain(issue.getMessage()), issue.getMessage()))
                    .toList();
            return RuleCheck.failed(issues);
        }
        CelType type = resultType(result);
        if (expect == Expect.CONDITION && type != SimpleType.BOOL) {
            return RuleCheck.failed(new RuleIssue(0, RuleMessage.of("ruleNotCondition"), type.name()));
        }
        if (expect == Expect.NUMBER && type != SimpleType.DOUBLE && type != SimpleType.INT) {
            return RuleCheck.failed(new RuleIssue(0, RuleMessage.of("ruleNotNumber"), type.name()));
        }
        return RuleCheck.passed(type.name());
    }

    /** Runs a rule on one sample. The rule must pass {@link #check} first. */
    public static RuleResult evaluate(RuleSchema schema, String expression, Map<String, Object> variables) {
        return prepare(schema, expression).run(variables);
    }

    /** Compiles a rule once, to run it on many samples. */
    public static PreparedRule prepare(RuleSchema schema, String expression) {
        Cel cel = cel(schema);
        CelValidationResult result = compile(cel, expression == null ? "" : expression).result();
        if (result.hasError()) {
            String error = RuleMessages.plain(result.getAllIssues().get(0).getMessage()).spanish();
            return variables -> RuleResult.failed(error);
        }
        try {
            CelRuntime.Program program = cel.createProgram(result.getAst());
            return variables -> {
                try {
                    return RuleResult.of(program.eval(withConstants(doubles(variables))));
                } catch (CelEvaluationException e) {
                    return RuleResult.failed(RuleMessages.plain(e.getMessage()).spanish());
                }
            };
        } catch (CelEvaluationException | CelValidationException e) {
            String error = RuleMessages.plain(e.getMessage()).spanish();
            return variables -> RuleResult.failed(error);
        }
    }

    /** A compiled rule. */
    @FunctionalInterface
    public interface PreparedRule {
        RuleResult run(Map<String, Object> variables);
    }

    /** Every number the schema declares is a double, so samples with whole numbers are converted. */
    @SuppressWarnings("unchecked")
    static Map<String, Object> doubles(Map<String, Object> values) {
        Map<String, Object> out = new LinkedHashMap<>();
        values.forEach((k, v) -> out.put(k, switch (v) {
            case Map<?, ?> m -> doubles((Map<String, Object>) m);
            case Double d -> d;
            case Number n -> n.doubleValue();
            case null, default -> v;
        }));
        return out;
    }

    private static Map<String, Object> withConstants(Map<String, Object> variables) {
        Map<String, Object> out = new LinkedHashMap<>(CONSTANTS);
        out.putAll(variables);
        return out;
    }

    /** The compiled rule and the text CEL saw. */
    private record Compiled(CelValidationResult result, EqualityLiterals literals) {
    }

    /**
     * Compiles the rule as written; when that fails, again with the integers
     * written as doubles where CEL rejected their == or != (see
     * {@link EqualityLiterals}). Comparisons that compiled keep their integers.
     */
    private static Compiled compile(Cel cel, String expression) {
        CelValidationResult asWritten = cel.compile(expression);
        if (!asWritten.hasError()) {
            return new Compiled(asWritten, new EqualityLiterals(expression, List.of()));
        }
        Set<Integer> failed = asWritten.getAllIssues().stream()
                .filter(issue -> issue.getSeverity() == CelIssue.Severity.ERROR)
                .map(issue -> offset(expression, issue))
                .collect(Collectors.toSet());
        EqualityLiterals literals = EqualityLiterals.of(expression, failed::contains);
        if (literals.inserted().isEmpty()) {
            return new Compiled(asWritten, literals);
        }
        return new Compiled(cel.compile(literals.text()), literals);
    }

    /** Offset in the whole rule of an issue CEL reports as line and column. */
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

    private static CelType resultType(CelValidationResult result) {
        try {
            return result.getAst().getResultType();
        } catch (CelValidationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Cel cel(RuleSchema schema) {
        synchronized (COMPILERS) {
            return COMPILERS.computeIfAbsent(schema, RuleLanguage::build);
        }
    }

    private static Cel build(RuleSchema schema) {
        Map<String, Map<String, CelType>> structs = new LinkedHashMap<>();
        structs.put(typeName(schema.root()), new LinkedHashMap<>());
        schema.fields().forEach((path, type) -> {
            String[] parts = path.split("\\.");
            StringBuilder parent = new StringBuilder(parts[0]);
            for (int i = 1; i < parts.length; i++) {
                String parentType = typeName(parent.toString());
                structs.computeIfAbsent(parentType, k -> new LinkedHashMap<>());
                parent.append('.').append(parts[i]);
                CelType child = i == parts.length - 1
                        ? scalar(type)
                        : StructTypeReference.create(typeName(parent.toString()));
                structs.get(parentType).putIfAbsent(parts[i], child);
            }
        });
        List<CelType> types = new ArrayList<>();
        structs.forEach((name, fields) -> types.add(StructType.create(name, ImmutableSet.copyOf(fields.keySet()),
                f -> Optional.ofNullable(fields.get(f)))));
        ImmutableList<CelType> all = ImmutableList.copyOf(types);
        var builder = CelFactory.standardCelBuilder()
                .setOptions(OPTIONS)
                .setStandardMacros(CelStandardMacro.HAS)
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
                .addVar(schema.root(), StructTypeReference.create(typeName(schema.root())));
        builder.addVar("NONE", OptionalType.create(SimpleType.DYN))
                .addVar("TRUE", OptionalType.create(SimpleType.BOOL))
                .addVar("FALSE", OptionalType.create(SimpleType.BOOL));
        schema.extras().forEach((name, type) -> builder.addVar(name, scalar(type)));
        return builder.build();
    }

    /** One CEL type per object path. Each segment is length-prefixed, so {@code a.b_c} and {@code a.b.c} differ. */
    static String typeName(String path) {
        StringBuilder name = new StringBuilder("T");
        for (String segment : path.split("\\.")) {
            name.append('_').append(segment.length()).append(segment);
        }
        return name.toString();
    }

    /** number and duration are doubles; yes/no is bool; text, lists, zones and times are strings. */
    static CelType scalar(String type) {
        return switch (type == null ? "" : type) {
            case "number", "duration" -> SimpleType.DOUBLE;
            case "bool" -> SimpleType.BOOL;
            default -> SimpleType.STRING;
        };
    }
}
