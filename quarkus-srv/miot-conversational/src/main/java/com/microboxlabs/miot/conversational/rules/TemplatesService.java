package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.ConvTemplate.PLATFORM_TENANT;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The platform's message templates, which every organization's rules use. Organizations read them with the rules of
 * their own that use each one; the platform reads them with every organization's rules and writes them. Each save
 * raises the template's semantic version by what changed ({@link TemplateBump}).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class TemplatesService {

    /** {@code tenantCode} names the rule's organization for the platform, and is left out for an organization. */
    public record RuleRef(String id, String key, String name, Rule.State state,
            @JsonInclude(JsonInclude.Include.NON_NULL) String tenantCode) {
    }

    public record TemplateView(String id, String key, String name, String baseText, ConvTemplate.WhatsApp whatsapp,
            ConvTemplate.Email email, String version, Instant updatedAt, String updatedBy, List<RuleRef> usedBy) {
    }

    public record TemplateRequest(String name, String baseText, ConvTemplate.WhatsApp whatsapp,
            ConvTemplate.Email email) {
    }

    /** A rule and the template keys its version in force and its draft use. */
    private record Usage(RuleRef rule, List<String> templateKeys) {
    }

    private final RuleStore rules;
    private final TemplateStore templates;
    private final Clock clock;

    @Inject
    TemplatesService(RuleStore rules, TemplateStore templates) {
        this(rules, templates, Clock.systemUTC());
    }

    public TemplatesService(RuleStore rules, TemplateStore templates, Clock clock) {
        this.rules = rules;
        this.templates = templates;
        this.clock = clock;
    }

    /** The platform's templates, each with the organization's rules that use it. */
    public List<TemplateView> list(String tenantCode) {
        List<Usage> usage = usage(rules.list(tenantCode), false);
        return templates.list(PLATFORM_TENANT).stream().map(t -> view(t, usage)).toList();
    }

    public TemplateView get(String tenantCode, String key) {
        return view(template(key), usage(rules.list(tenantCode), false));
    }

    /** The platform's templates, each with every organization's rules that use it. */
    public List<TemplateView> platformList() {
        List<Usage> usage = usage(rules.listAll(), true);
        return templates.list(PLATFORM_TENANT).stream().map(t -> view(t, usage)).toList();
    }

    public TemplateView platformGet(String key) {
        return view(template(key), usage(rules.listAll(), true));
    }

    /** Creates or replaces a platform template; a new one is 0.1.0, a changed one is bumped, an equal one kept. */
    public TemplateView save(String key, TemplateRequest body, String actor) {
        RulesService.requireKey(key);
        if (body == null || body.name() == null || body.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (body.whatsapp() != null && blank(body.whatsapp().metaName())) {
            throw new IllegalArgumentException("whatsapp.metaName is required");
        }
        if (body.email() != null && (blank(body.email().subject()) || blank(body.email().body()))) {
            throw new IllegalArgumentException("email.subject and email.body are required");
        }
        Instant now = clock.instant();
        Optional<ConvTemplate> existing = templates.find(PLATFORM_TENANT, key);
        ConvTemplate next = new ConvTemplate(existing.map(ConvTemplate::id).orElse(UUID.randomUUID().toString()),
                PLATFORM_TENANT, key, body.name().trim(), body.baseText(), body.whatsapp(), body.email(),
                existing.map(ConvTemplate::createdAt).orElse(now), now, actor, RuleBump.FIRST);
        if (existing.isPresent()) {
            RuleBump bump = TemplateBump.between(existing.get(), next);
            if (bump == null) {
                return platformGet(key);
            }
            next = new ConvTemplate(next.id(), next.tenantCode(), key, next.name(), next.baseText(), next.whatsapp(),
                    next.email(), next.createdAt(), now, actor, bump.next(existing.get().version()));
        }
        templates.upsert(next, existing.map(ConvTemplate::version).orElse(null))
                .orElseThrow(() -> new IllegalStateException(
                        "La plantilla cambió mientras se guardaba; vuelve a guardarla"));
        return platformGet(key);
    }

    private ConvTemplate template(String key) {
        return templates.find(PLATFORM_TENANT, key)
                .orElseThrow(() -> new NoSuchElementException("Template not found"));
    }

    private List<Usage> usage(List<Rule> list, boolean withTenant) {
        Map<String, List<RuleVersion>> live = rules.liveVersions(list.stream().map(Rule::id).toList()).stream()
                .collect(Collectors.groupingBy(RuleVersion::ruleId));
        List<Usage> out = new ArrayList<>();
        for (Rule r : list) {
            List<RuleVersion> versions = live.getOrDefault(r.id(), List.of());
            List<String> keys = new ArrayList<>();
            for (RuleVersion v : new RuleVersion[] {RulesService.current(r, versions), RulesService.draft(versions)}) {
                if (v != null) {
                    RuleSpec.read(v.spec()).steps().forEach(s -> keys.add(s.template()));
                }
            }
            out.add(new Usage(new RuleRef(r.id(), r.key(), r.name(), r.state(), withTenant ? r.tenantCode() : null),
                    keys));
        }
        return out;
    }

    private static TemplateView view(ConvTemplate t, List<Usage> usage) {
        List<RuleRef> usedBy = usage.stream().filter(u -> u.templateKeys().contains(t.key())).map(Usage::rule)
                .toList();
        return new TemplateView(t.id(), t.key(), t.name(), t.baseText(), t.whatsapp(), t.email(), t.version(),
                t.updatedAt(), t.updatedBy(), usedBy);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
