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
import dev.cel.common.types.SimpleType;
import dev.cel.common.types.StructType;
import dev.cel.common.types.StructTypeReference;
import dev.cel.runtime.CelEvaluationException;
import dev.cel.runtime.CelRuntime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Checks and evaluates symptom rules written in CEL. The schema's field
 * types become CEL types, so unknown fields and wrong types are rejected
 * before a rule runs. Messages are in Spanish, for the symptom owner.
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

    private static final Map<RuleSchema, Cel> COMPILERS = new ConcurrentHashMap<>();

    private RuleLanguage() {
    }

    public static RuleCheck check(RuleSchema schema, String expression, Expect expect) {
        if (expression == null || expression.isBlank()) {
            return RuleCheck.failed(new RuleIssue(0, "La expresión está vacía.", ""));
        }
        CelValidationResult result = cel(schema).compile(expression);
        if (result.hasError()) {
            List<RuleIssue> issues = new ArrayList<>();
            for (CelIssue issue : result.getAllIssues()) {
                if (issue.getSeverity() == CelIssue.Severity.ERROR) {
                    issues.add(new RuleIssue(Math.max(0, issue.getSourceLocation().getColumn()),
                            RuleMessages.plain(issue.getMessage()), issue.getMessage()));
                }
            }
            return RuleCheck.failed(issues);
        }
        CelType type = resultType(result);
        if (expect == Expect.CONDITION && type != SimpleType.BOOL) {
            return RuleCheck.failed(new RuleIssue(0, "La condición debe dar sí o no.", type.name()));
        }
        if (expect == Expect.NUMBER && type != SimpleType.DOUBLE && type != SimpleType.INT) {
            return RuleCheck.failed(new RuleIssue(0, "La medida debe dar un número.", type.name()));
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
        CelValidationResult result = cel.compile(expression == null ? "" : expression);
        if (result.hasError()) {
            String error = RuleMessages.plain(result.getAllIssues().get(0).getMessage());
            return variables -> RuleResult.failed(error);
        }
        try {
            CelRuntime.Program program = cel.createProgram(result.getAst());
            return variables -> {
                try {
                    return RuleResult.of(program.eval(variables));
                } catch (CelEvaluationException e) {
                    return RuleResult.failed(RuleMessages.plain(e.getMessage()));
                }
            };
        } catch (CelEvaluationException | CelValidationException e) {
            String error = RuleMessages.plain(e.getMessage());
            return variables -> RuleResult.failed(error);
        }
    }

    /** A compiled rule. */
    @FunctionalInterface
    public interface PreparedRule {
        RuleResult run(Map<String, Object> variables);
    }

    private static CelType resultType(CelValidationResult result) {
        try {
            return result.getAst().getResultType();
        } catch (CelValidationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Cel cel(RuleSchema schema) {
        return COMPILERS.computeIfAbsent(schema, RuleLanguage::build);
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
        schema.extras().forEach((name, type) -> builder.addVar(name, scalar(type)));
        return builder.build();
    }

    private static String typeName(String path) {
        return "T_" + path.replace('.', '_');
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
