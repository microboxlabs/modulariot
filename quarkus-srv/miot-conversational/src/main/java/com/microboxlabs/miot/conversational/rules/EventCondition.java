package com.microboxlabs.miot.conversational.rules;

import dev.cel.bundle.Cel;
import dev.cel.bundle.CelFactory;
import dev.cel.common.CelIssue;
import dev.cel.common.CelOptions;
import dev.cel.common.CelValidationException;
import dev.cel.common.CelValidationResult;
import dev.cel.common.types.CelType;
import dev.cel.common.types.MapType;
import dev.cel.common.types.SimpleType;
import dev.cel.parser.CelStandardMacro;
import dev.cel.runtime.CelEvaluationException;
import dev.cel.runtime.CelRuntime;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * A rule's {@code when}: CEL over {@code event}, a map with {@code type}, {@code context}, {@code data},
 * {@code test} and {@code at}. {@code event.data} is untyped, so a compile only finds syntax errors and unknown
 * variables; a field the event does not have makes the condition false. Numbers compare across int and double.
 */
public final class EventCondition {

    /** A compile error at a zero-based character offset. */
    public record Issue(int position, String message, String detail) {
    }

    private static final Cel CEL = CelFactory.standardCelBuilder()
            .setOptions(CelOptions.current().enableHeterogeneousNumericComparisons(true).build())
            .setStandardMacros(CelStandardMacro.STANDARD_MACROS)
            .addVar("event", MapType.create(SimpleType.STRING, SimpleType.DYN))
            .build();

    private static final int MAX_PROGRAMS = 512;

    private static final Map<String, CelRuntime.Program> PROGRAMS = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, CelRuntime.Program> eldest) {
            return size() > MAX_PROGRAMS;
        }
    };

    private EventCondition() {
    }

    /** The first compile error, or empty when the condition compiles to a yes/no (or is blank). */
    public static Optional<Issue> check(String when) {
        if (when == null || when.isBlank()) {
            return Optional.empty();
        }
        CelValidationResult result = CEL.compile(when);
        if (result.hasError()) {
            CelIssue issue = result.getAllIssues().stream()
                    .filter(i -> i.getSeverity() == CelIssue.Severity.ERROR)
                    .findFirst().orElse(result.getAllIssues().get(0));
            return Optional.of(new Issue(offset(when, issue), "La condición no es válida: " + issue.getMessage(),
                    issue.getMessage()));
        }
        CelType type = resultType(result);
        if (type != SimpleType.BOOL && type != SimpleType.DYN) {
            return Optional.of(new Issue(0, "La condición debe dar sí o no.", type.name()));
        }
        return Optional.empty();
    }

    /** Whether the event meets the condition; a blank condition always does, an error never does. */
    public static boolean matches(String when, Map<String, Object> event) {
        if (when == null || when.isBlank()) {
            return true;
        }
        CelRuntime.Program program = program(when);
        if (program == null) {
            return false;
        }
        try {
            return Boolean.TRUE.equals(program.eval(Map.of("event", normalize(event))));
        } catch (CelEvaluationException | RuntimeException e) {
            return false;
        }
    }

    private static CelRuntime.Program program(String when) {
        synchronized (PROGRAMS) {
            CelRuntime.Program cached = PROGRAMS.get(when);
            if (cached != null) {
                return cached;
            }
        }
        CelValidationResult result = CEL.compile(when);
        if (result.hasError()) {
            return null;
        }
        try {
            CelRuntime.Program program = CEL.createProgram(result.getAst());
            synchronized (PROGRAMS) {
                PROGRAMS.put(when, program);
            }
            return program;
        } catch (CelEvaluationException | CelValidationException e) {
            return null;
        }
    }

    /** Whole numbers become long and the others double, as CEL expects; null entries are left out. */
    static Object normalize(Object value) {
        return switch (value) {
            case Map<?, ?> m -> {
                Map<String, Object> out = new LinkedHashMap<>();
                m.forEach((k, v) -> {
                    if (v != null) {
                        out.put(String.valueOf(k), normalize(v));
                    }
                });
                yield out;
            }
            case List<?> l -> {
                List<Object> out = new ArrayList<>();
                l.forEach(v -> out.add(v == null ? "" : normalize(v)));
                yield out;
            }
            case Integer i -> i.longValue();
            case Short s -> s.longValue();
            case Byte b -> b.longValue();
            case BigInteger b -> b.longValue();
            case Float f -> f.doubleValue();
            case BigDecimal b -> b.doubleValue();
            case null -> "";
            default -> value;
        };
    }

    private static int offset(String expression, CelIssue issue) {
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
}
