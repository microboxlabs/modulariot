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
            return spacing(rule);
        }
        return parse(rule).map(UNPARSER::unparse).orElse(rule.trim());
    }

    /**
     * The rule with spacing outside strings normalized: none next to a symbol,
     * one space between two words ({@code a in b}). Strings are kept as written.
     */
    static String spacing(String rule) {
        StringBuilder out = new StringBuilder();
        boolean quoted = false;
        boolean pendingSpace = false;
        int i = 0;
        String text = rule.trim();
        while (i < text.length()) {
            char c = text.charAt(i);
            if (quoted) {
                out.append(c);
                if (c == '\\' && i + 1 < text.length()) {
                    out.append(text.charAt(++i));
                } else if (c == '"') {
                    quoted = false;
                }
            } else if (Character.isWhitespace(c)) {
                pendingSpace = true;
            } else {
                if (pendingSpace && !out.isEmpty() && word(out.charAt(out.length() - 1)) && word(c)) {
                    out.append(' ');
                }
                pendingSpace = false;
                out.append(c);
                quoted = c == '"';
            }
            i++;
        }
        return out.toString();
    }

    private static boolean word(char c) {
        return Character.isLetterOrDigit(c) || c == '_' || c == '.';
    }

    /** The text of a CEL string literal, escapes decoded, or empty when the text is not one. */
    public static Optional<String> stringLiteral(String literal) {
        return parse(literal)
                .map(CelAbstractSyntaxTree::getExpr)
                .filter(e -> e.exprKind().getKind() == ExprKind.Kind.CONSTANT
                        && e.constant().getKind() == CelConstant.Kind.STRING_VALUE)
                .map(e -> e.constant().stringValue());
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

    /**
     * How many conditions the rule joins with {@code &&} at its root, looking
     * through nested {@code &&}; 1 for any other rule, 0 when it does not parse.
     */
    public static int conjunctionSize(String rule) {
        return parse(rule).map(ast -> conjuncts(ast.getExpr())).orElse(0);
    }

    private static int conjuncts(CelExpr e) {
        if (e.exprKind().getKind() == ExprKind.Kind.CALL && e.call().function().equals("_&&_")) {
            return e.call().args().stream().mapToInt(RuleText::conjuncts).sum();
        }
        return 1;
    }

    /** A field compared with a text, such as {@code signal.geo.zone == "Puerto"}. */
    public record TextComparison(String path, String value) {
    }

    /**
     * Every field compared with a text anywhere in the rule: {@code ==},
     * {@code !=} and {@code in [...]}, inside groups, negations and either
     * side of {@code ||}.
     */
    public static List<TextComparison> textComparisons(String rule) {
        List<TextComparison> out = new ArrayList<>();
        parse(rule).ifPresent(ast -> CelNavigableAst.fromAst(ast).getRoot().allNodes()
                .filter(n -> n.getKind() == ExprKind.Kind.CALL)
                .map(CelNavigableExpr::expr)
                .forEach(e -> textComparisons(e, out)));
        return out;
    }

    private static void textComparisons(CelExpr call, List<TextComparison> out) {
        String function = call.call().function();
        List<CelExpr> args = call.call().args();
        if (args.size() != 2) {
            return;
        }
        if (function.equals("_==_") || function.equals("_!=_")) {
            Optional<String> left = path(args.get(0));
            Optional<String> right = path(args.get(1));
            left.ifPresent(p -> text(args.get(1)).ifPresent(v -> out.add(new TextComparison(p, v))));
            right.ifPresent(p -> text(args.get(0)).ifPresent(v -> out.add(new TextComparison(p, v))));
        } else if (function.equals("@in") && args.get(1).exprKind().getKind() == ExprKind.Kind.LIST) {
            path(args.get(0)).ifPresent(p -> args.get(1).list().elements().forEach(
                    e -> text(e).ifPresent(v -> out.add(new TextComparison(p, v)))));
        }
    }

    private static Optional<String> text(CelExpr e) {
        return e.exprKind().getKind() == ExprKind.Kind.CONSTANT
                && e.constant().getKind() == CelConstant.Kind.STRING_VALUE
                        ? Optional.of(e.constant().stringValue())
                        : Optional.empty();
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
