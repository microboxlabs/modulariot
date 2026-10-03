package com.microboxlabs.miot.symptoms.catalog.cel;

import dev.cel.common.CelAbstractSyntaxTree;
import dev.cel.common.CelValidationException;
import dev.cel.common.CelValidationResult;
import dev.cel.common.ast.CelConstant;
import dev.cel.common.ast.CelExpr;
import dev.cel.common.ast.CelExpr.ExprKind;
import dev.cel.common.navigation.CelNavigableAst;
import dev.cel.common.navigation.CelNavigableExpr;
import dev.cel.compiler.CelCompiler;
import dev.cel.compiler.CelCompilerFactory;
import dev.cel.parser.CelUnparser;
import dev.cel.parser.CelUnparserFactory;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * What a rule says, read from its parsed form rather than its text: a
 * canonical text, the fields it reads and the numbers it compares with.
 * Needs no schema.
 */
public final class RuleText {

    private static final CelCompiler PARSER = CelCompilerFactory.standardCelCompilerBuilder().build();
    private static final CelUnparser UNPARSER = CelUnparserFactory.newUnparser();

    private RuleText() {
    }

    /** One text per meaning, so spacing and line breaks are not a change. Unparseable rules are only trimmed. */
    public static String canonical(String rule) {
        if (rule == null) {
            return null;
        }
        // The unparser writes string constants without escaping them: "a\\"b" would come back as "a"b".
        if (rule.indexOf('\\') >= 0) {
            return rule.trim();
        }
        return parse(rule).map(UNPARSER::unparse).orElse(rule.trim());
    }

    /** Field paths the rule reads, such as {@code signal.gps.speed_kmh}. Text inside strings is not a field. */
    public static Set<String> fieldPaths(String rule) {
        Set<String> all = new LinkedHashSet<>();
        parse(rule).ifPresent(ast -> CelNavigableAst.fromAst(ast).getRoot().allNodes()
                .filter(n -> n.getKind() == ExprKind.Kind.SELECT)
                .map(n -> path(n.expr()))
                .forEach(p -> p.ifPresent(all::add)));
        return all.stream()
                .filter(p -> all.stream().noneMatch(other -> other.startsWith(p + ".")))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /** The numeric literals in the rule. */
    public static List<Double> numbers(String rule) {
        List<Double> out = new ArrayList<>();
        parse(rule).ifPresent(ast -> CelNavigableAst.fromAst(ast).getRoot().allNodes()
                .filter(n -> n.getKind() == ExprKind.Kind.CONSTANT)
                .map(CelNavigableExpr::expr)
                .forEach(e -> number(e.constant()).ifPresent(out::add)));
        return out;
    }

    private static Optional<Double> number(CelConstant c) {
        return switch (c.getKind()) {
            case DOUBLE_VALUE -> Optional.of(c.doubleValue());
            case INT64_VALUE -> Optional.of((double) c.int64Value());
            case UINT64_VALUE -> Optional.of(c.uint64Value().doubleValue());
            default -> Optional.empty();
        };
    }

    private static Optional<String> path(CelExpr e) {
        return switch (e.exprKind().getKind()) {
            case IDENT -> Optional.of(e.ident().name());
            case SELECT -> path(e.select().operand()).map(base -> base + "." + e.select().field());
            default -> Optional.empty();
        };
    }

    private static Optional<CelAbstractSyntaxTree> parse(String rule) {
        if (rule == null || rule.isBlank()) {
            return Optional.empty();
        }
        CelValidationResult result = PARSER.parse(rule);
        if (result.hasError()) {
            return Optional.empty();
        }
        try {
            return Optional.of(result.getAst());
        } catch (CelValidationException e) {
            return Optional.empty();
        }
    }
}
