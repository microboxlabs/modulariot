package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/** The organization's message templates, each with the rules whose draft or version in force uses it. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class TemplatesService {

    public record RuleRef(String id, String key, String name, Rule.State state) {
    }

    public record TemplateView(String id, String key, String name, String baseText, ConvTemplate.WhatsApp whatsapp,
            ConvTemplate.Email email, Instant updatedAt, String updatedBy, List<RuleRef> usedBy) {
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

    public List<TemplateView> list(String tenantCode) {
        List<Usage> usage = usage(tenantCode);
        return templates.list(tenantCode).stream().map(t -> view(t, usage)).toList();
    }

    public TemplateView get(String tenantCode, String key) {
        ConvTemplate t = templates.find(tenantCode, key)
                .orElseThrow(() -> new NoSuchElementException("Template not found"));
        return view(t, usage(tenantCode));
    }

    public TemplateView save(String tenantCode, String key, TemplateRequest body, String actor) {
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
        Optional<ConvTemplate> existing = templates.find(tenantCode, key);
        ConvTemplate saved = templates.upsert(new ConvTemplate(
                existing.map(ConvTemplate::id).orElse(UUID.randomUUID().toString()), tenantCode, key,
                body.name().trim(), body.baseText(), body.whatsapp(), body.email(),
                existing.map(ConvTemplate::createdAt).orElse(now), now, actor));
        return view(saved, usage(tenantCode));
    }

    private List<Usage> usage(String tenantCode) {
        List<Usage> out = new ArrayList<>();
        for (Rule r : rules.list(tenantCode)) {
            List<RuleVersion> versions = rules.versions(r.id());
            List<String> keys = new ArrayList<>();
            for (RuleVersion v : new RuleVersion[] {RulesService.current(r, versions), RulesService.draft(versions)}) {
                if (v != null) {
                    RuleSpec.read(v.spec()).steps().forEach(s -> keys.add(s.template()));
                }
            }
            out.add(new Usage(new RuleRef(r.id(), r.key(), r.name(), r.state()), keys));
        }
        return out;
    }

    private static TemplateView view(ConvTemplate t, List<Usage> usage) {
        List<RuleRef> usedBy = usage.stream().filter(u -> u.templateKeys().contains(t.key())).map(Usage::rule)
                .toList();
        return new TemplateView(t.id(), t.key(), t.name(), t.baseText(), t.whatsapp(), t.email(), t.updatedAt(),
                t.updatedBy(), usedBy);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
