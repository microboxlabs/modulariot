package com.microboxlabs.miot.core.mcp;

import com.microboxlabs.miot.core.api.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.core.api.dto.SelectableRequest;
import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectableOptionSource;
import com.microboxlabs.miot.core.selectable.SelectableService;
import com.microboxlabs.miot.core.selectable.SourceUnavailableException;
import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolCallException;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

/**
 * The organization's option lists as MCP tools: the same operations as
 * {@code /api/v1/orgs/{org}/selectables}, under the same rules. Any member
 * reads; writes need an organization owner. Restoring the defaults is left
 * out: it drops every list and binding at once.
 *
 * <p>Each tool lets the caller into the organization on the event loop, as
 * that check reads through Hibernate Reactive, then calls the service on the
 * worker pool.
 */
@Singleton
public class SelectableTools {

    static final String ORGANIZATION = "The organization's slug, as in /api/v1/orgs/{slug}.";
    static final String KEY = "The list's key, e.g. delay_reason.";

    public record Lists(List<Selectable> selectables) {
    }

    public record Options(List<SelectableOption> options) {
    }

    public record Sources(List<SelectableOptionSource.Descriptor> sources) {
    }

    public record Bindings(Map<String, String> bindings) {
    }

    private final McpCaller caller;
    private final SelectableService selectables;

    @Inject
    public SelectableTools(McpCaller caller, SelectableService selectables) {
        this.caller = caller;
        this.selectables = selectables;
    }

    @Tool(name = "selectables_list", structuredContent = true,
            description = "The option lists behind the organization's form fields, with their options."
                    + " The first call seeds the defaults of the enabled components.",
            annotations = @Tool.Annotations(title = "List option lists", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Lists> list(@ToolArg(description = ORGANIZATION) String organization) {
        return caller.member(organization)
                .flatMap(in -> work(() -> new Lists(selectables.list(in.tenantCode()))));
    }

    @Tool(name = "selectables_get", structuredContent = true,
            description = "One option list: its settings, source and, for a static list, its options.",
            annotations = @Tool.Annotations(title = "Get an option list", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Selectable> get(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = KEY) String key) {
        return caller.member(organization)
                .flatMap(in -> work(() -> selectables.get(in.tenantCode(), key)));
    }

    @Tool(name = "selectables_options", structuredContent = true,
            description = "The options a field shows: a static list's own, or what its source returns."
                    + " Use search to filter by value or label (accents ignored), and parents for a list"
                    + " that depends on another one.",
            annotations = @Tool.Annotations(title = "Get the options of a list", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = true))
    public Uni<Options> options(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = KEY) String key,
            @ToolArg(description = "Text to look for in the value or label.", required = false) String search,
            @ToolArg(description = "Values picked in the list this one depends on.", required = false)
            List<String> parents,
            @ToolArg(description = "At most this many options; 50 when not given.", required = false)
            Integer limit) {
        return caller.member(organization)
                .flatMap(in -> work(() -> new Options(
                        selectables.options(in.tenantCode(), key, search, parents, limit))));
    }

    @Tool(name = "selectables_sources", structuredContent = true,
            description = "Where a dynamic list can take its options from: the system sources of the enabled"
                    + " components, and the organization's usable connections. Use a source's kind and ref in"
                    + " selectables_replace.",
            annotations = @Tool.Annotations(title = "List option sources", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Sources> sources(@ToolArg(description = ORGANIZATION) String organization) {
        return caller.member(organization)
                .flatMap(in -> work(() -> new Sources(selectables.sources(in.tenantCode()))));
    }

    @Tool(name = "selectables_bindings", structuredContent = true,
            description = "Which list each form field uses, as field key to list key. A field that is not"
                    + " listed uses the list whose key equals the field key.",
            annotations = @Tool.Annotations(title = "Get field bindings", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Bindings> bindings(@ToolArg(description = ORGANIZATION) String organization) {
        return caller.member(organization)
                .flatMap(in -> work(() -> new Bindings(selectables.bindings(in.tenantCode()))));
    }

    @Tool(name = "selectables_replace", structuredContent = true,
            description = "Creates a list, or replaces it whole. Keep existing option values: records store"
                    + " them. A SYSTEM or CONNECTION list takes its options from its source and must send none."
                    + " Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Create or replace an option list", readOnlyHint = false,
                    destructiveHint = true, idempotentHint = true, openWorldHint = false))
    public Uni<Selectable> replace(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = KEY) String key,
            @ToolArg(description = "The whole list. Texts are per language, e.g. {\"es\": \"Motivo\","
                    + " \"en\": \"Reason\"}. mode is SINGLE or MULTIPLE.") SelectableRequest list) {
        return caller.owner(organization)
                .flatMap(in -> work(() -> selectables.replace(in.tenantCode(), in.actor(), key, list)));
    }

    @Tool(name = "selectables_delete",
            description = "Deletes a list and the bindings that pointed at it. Refused while another list"
                    + " depends on it. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Delete an option list", readOnlyHint = false,
                    destructiveHint = true, idempotentHint = true, openWorldHint = false))
    public Uni<String> delete(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = KEY) String key) {
        return caller.owner(organization)
                .flatMap(in -> work(() -> {
                    if (!selectables.delete(in.tenantCode(), in.actor(), key)) {
                        throw new NoSuchElementException("selectable not found: " + key);
                    }
                    return "Deleted " + key + ".";
                }));
    }

    @Tool(name = "selectables_bind", structuredContent = true,
            description = "Points form fields at lists, as field key to list key. Fields not given keep their"
                    + " binding. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Bind form fields to lists", readOnlyHint = false,
                    destructiveHint = false, idempotentHint = true, openWorldHint = false))
    public Uni<Bindings> bind(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = "Field key to list key.") Map<String, String> bindings) {
        return caller.owner(organization)
                .flatMap(in -> work(() -> new Bindings(selectables.updateBindings(in.tenantCode(), in.actor(),
                        new SelectableBindingsRequest(bindings)))));
    }

    private static <T> Uni<T> work(Supplier<T> call) {
        return Uni.createFrom().item(() -> guarded(call))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    /** What the REST resource answers 400, 404 or 502 for, the model gets as a failed tool call. */
    static <T> T guarded(Supplier<T> call) {
        try {
            return call.get();
        } catch (IllegalArgumentException | NoSuchElementException | SourceUnavailableException e) {
            throw new ToolCallException(e.getMessage(), e);
        }
    }
}
