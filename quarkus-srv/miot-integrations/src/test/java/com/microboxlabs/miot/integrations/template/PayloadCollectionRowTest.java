package com.microboxlabs.miot.integrations.template;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Phase 1 of separating the target contract from the binding: an array's element source is the
 * binding's to declare, on a row keyed by the array's own dotted path.
 *
 * <p>{@code itemsFrom} in a {@code request_schema} is a mapping decision stored in the contract —
 * a partner's schema describes the shape they accept and knows nothing of our event snapshot. So a
 * pasted, unannotated partner schema plus two collection rows must render exactly what the
 * annotated schema rendered, and every contract stored before the split must keep working.
 *
 * <p>See {@code docs/contract-binding-separation.md}.
 */
class PayloadCollectionRowTest {

    private final PayloadRenderer renderer = new PayloadRenderer();

    /** The partner's contract as their own documentation would give it: no itemsFrom anywhere. */
    private static PayloadSchema pureContract() {
        Map<String, Object> noteProps = new LinkedHashMap<>();
        noteProps.put("code", Map.of("type", "string"));
        Map<String, Object> notes = Map.of(
                "type", "array",
                "items", Map.of("type", "object", "properties", noteProps,
                        "required", List.of("code")));

        Map<String, Object> itemProps = new LinkedHashMap<>();
        itemProps.put("mediaId", Map.of("type", "string"));
        itemProps.put("notes", notes);
        Map<String, Object> items = Map.of(
                "type", "array",
                "items", Map.of("type", "object", "properties", itemProps,
                        "required", List.of("mediaId")));

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("reference", Map.of("type", "string"));
        envelope.put("items", items);
        return PayloadSchema.of(Map.of(
                "type", "object", "properties", envelope,
                "required", List.of("reference", "items")));
    }

    /** The same contract as stored today: the producer's collections baked into the schema. */
    private static PayloadSchema annotatedContract() {
        Map<String, Object> noteProps = new LinkedHashMap<>();
        noteProps.put("code", Map.of("type", "string"));
        Map<String, Object> notes = Map.of(
                "type", "array",
                "itemsFrom", "content.reasons",
                "items", Map.of("type", "object", "properties", noteProps,
                        "required", List.of("code")));

        Map<String, Object> itemProps = new LinkedHashMap<>();
        itemProps.put("mediaId", Map.of("type", "string"));
        itemProps.put("notes", notes);
        Map<String, Object> items = Map.of(
                "type", "array",
                "itemsFrom", "content",
                "items", Map.of("type", "object", "properties", itemProps,
                        "required", List.of("mediaId")));

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("reference", Map.of("type", "string"));
        envelope.put("items", items);
        return PayloadSchema.of(Map.of(
                "type", "object", "properties", envelope,
                "required", List.of("reference", "items")));
    }

    /** Value rows, plus a collection row per array — what the binding will carry after P2. */
    private static final Map<String, String> WITH_COLLECTION_ROWS = Map.of(
            "reference", "{{task.serviceCode}}",
            "items", "{{content}}",
            "items.mediaId", "{{content.mediaId}}",
            "items.notes", "{{content.reasons}}",
            "items.notes.code", "{{reasons.code}}");

    /** The same mapping without them — every source left to the schema. */
    private static final Map<String, String> VALUES_ONLY = Map.of(
            "reference", "{{task.serviceCode}}",
            "items.mediaId", "{{content.mediaId}}",
            "items.notes.code", "{{reasons.code}}");

    @Test
    void aPastedContractPlusCollectionRowsRendersWhatTheAnnotatedSchemaDid() {
        Object fromBinding = renderer.renderBody(WITH_COLLECTION_ROWS, pureContract(), context());
        Object fromSchema = renderer.renderBody(VALUES_ONLY, annotatedContract(), context());

        assertEquals(fromSchema, fromBinding, "the source moved; the payload must not");

        // And it is the shape we expect, not two matching mistakes.
        Map<?, ?> envelope = assertInstanceOf(Map.class, fromBinding);
        assertEquals("svc-1", envelope.get("reference"));
        List<?> items = assertInstanceOf(List.class, envelope.get("items"));
        assertEquals(2, items.size());
        Map<?, ?> rejected = (Map<?, ?>) items.get(1);
        List<?> notes = assertInstanceOf(List.class, rejected.get("notes"));
        assertEquals("wrong_format", ((Map<?, ?>) notes.get(0)).get("code"));
    }

    @Test
    void aBindingDeclaredSourceWinsOverTheSchemas() {
        // The schema says the nested array iterates content; the binding says content.reasons.
        // The binding is the mapping layer, so it decides — otherwise the fallback would be
        // indistinguishable from a preference.
        Map<String, String> rows = new LinkedHashMap<>(WITH_COLLECTION_ROWS);
        PayloadSchema schemaSaysContent = annotatedContractWithNotesFrom("content");

        Object body = renderer.renderBody(rows, schemaSaysContent, context());
        Map<?, ?> rejected = (Map<?, ?>) ((List<?>) ((Map<?, ?>) body).get("items")).get(1);
        List<?> notes = assertInstanceOf(List.class, rejected.get("notes"));

        assertEquals(1, notes.size(), "one reason, so the binding's content.reasons won");
        assertEquals("wrong_format", ((Map<?, ?>) notes.get(0)).get("code"));
    }

    @Test
    void collectionRowsSupplyTheRootsTheirElementsAreReadUnder() {
        // A pure contract declares no itemsFrom, so without the binding there is no `reasons`
        // root and {{reasons.code}} would be rejected. The collection row introduces it.
        assertEquals(List.of("content"), pureContract().arrayBindNames(),
                "the contract alone knows only the default collection");
        assertEquals(List.of("content", "reasons"),
                pureContract().arrayBindNames(WITH_COLLECTION_ROWS));

        assertTrue(renderer.validate(WITH_COLLECTION_ROWS, pureContract(),
                        PayloadTemplate.DEFAULT_ROOTS).isEmpty(),
                "a pasted contract plus collection rows must be storable");
    }

    @Test
    void arrayPathsAreTheRowsThatNameACollection() {
        assertEquals(List.of("items", "items.notes"), pureContract().arrayPaths());
    }

    @Test
    void aCollectionRowMayNameABareRootThoughAValueRowMayNot() {
        // {{content}} is a whole object to a value row and exactly right to a collection row.
        assertEquals("content", PayloadSchema.collectionPathOf("{{content}}"));
        assertEquals("content.reasons", PayloadSchema.collectionPathOf("{{ content.reasons }}"));

        List<String> problems = renderer.validate(
                Map.of("reference", "{{content}}"), pureContract(), PayloadTemplate.DEFAULT_ROOTS);
        assertTrue(problems.stream().anyMatch(p -> p.contains("reference")),
                "a value row naming a whole object is still refused: " + problems);
    }

    @Test
    void aMalformedCollectionRowIsReportedRatherThanSilentlyIgnored() {
        for (String bad : List.of("content.reasons", "{{}}", "{{a}} {{b}}", "{{helper x}}", "text")) {
            List<String> problems = renderer.validate(
                    Map.of("reference", "{{task.serviceCode}}",
                            "items.mediaId", "{{content.mediaId}}",
                            "items", bad),
                    pureContract(), PayloadTemplate.DEFAULT_ROOTS);
            assertTrue(problems.stream().anyMatch(p -> p.startsWith("'items':")),
                    "expected a problem for collection row " + bad + " but got " + problems);
        }
    }

    @Test
    void aCollectionRowNamingAnUnknownRootIsRefused() {
        List<String> problems = renderer.validate(
                Map.of("reference", "{{task.serviceCode}}",
                        "items.mediaId", "{{content.mediaId}}",
                        "items", "{{nope.things}}"),
                pureContract(), PayloadTemplate.DEFAULT_ROOTS);

        assertTrue(problems.stream().anyMatch(p -> p.contains("'nope'")), problems.toString());
    }

    private static PayloadSchema annotatedContractWithNotesFrom(String itemsFrom) {
        Map<String, Object> notes = Map.of(
                "type", "array",
                "itemsFrom", itemsFrom,
                "items", Map.of("type", "object", "properties",
                        Map.of("code", Map.of("type", "string"))));
        Map<String, Object> itemProps = new LinkedHashMap<>();
        itemProps.put("mediaId", Map.of("type", "string"));
        itemProps.put("notes", notes);
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("reference", Map.of("type", "string"));
        envelope.put("items", Map.of(
                "type", "array", "itemsFrom", "content",
                "items", Map.of("type", "object", "properties", itemProps)));
        return PayloadSchema.of(Map.of("type", "object", "properties", envelope));
    }

    private static Map<String, Object> context() {
        Map<String, Object> approved = new LinkedHashMap<>();
        approved.put("mediaId", "m1");

        Map<String, Object> rejected = new LinkedHashMap<>();
        rejected.put("mediaId", "m2");
        rejected.put("reasons", List.of(Map.of("code", "wrong_format")));

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("task", Map.of("serviceCode", "svc-1"));
        context.put("content", List.of(approved, rejected));
        return context;
    }
}
