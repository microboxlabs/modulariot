package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.ConvTemplate.PLATFORM_TENANT;
import com.microboxlabs.miot.conversational.calling.CallPermissionService;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.core.mail.MailTemplateEngine.Rendered;
import com.microboxlabs.miot.core.mail.NotificationMail;
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
 * The message templates. The platform's are used by every organization's rules, and the platform writes them. An
 * organization's own are used only by its rules, and it writes them; one of its own replaces the platform's with
 * the same key. Each template is read with the rules that use it. Each save raises the template's semantic version
 * by what changed ({@link TemplateBump}).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class TemplatesService {

    /**
     * {@code event} is the event type the rule listens to, for the variables a template editor offers.
     * {@code tenantCode} names the rule's organization for the platform, and is left out for an organization.
     */
    public record RuleRef(String id, String key, String name, Rule.State state,
            @JsonInclude(JsonInclude.Include.NON_NULL) String event,
            @JsonInclude(JsonInclude.Include.NON_NULL) String tenantCode) {
    }

    /** {@code owner} is {@value ConvTemplate#OWNER_PLATFORM} or {@value ConvTemplate#OWNER_ORGANIZATION}. */
    public record TemplateView(String id, String key, String name, String baseText, ConvTemplate.WhatsApp whatsapp,
            ConvTemplate.Email email, @JsonInclude(JsonInclude.Include.NON_NULL) ConvTemplate.Teams teams,
            List<ConvTemplate.Param> params, String owner, String version, Instant updatedAt, String updatedBy,
            List<RuleRef> usedBy) {
    }

    /** {@code teams} null saves the template without a Teams card; {@code params} null, without parameters. */
    public record TemplateRequest(String name, String baseText, ConvTemplate.WhatsApp whatsapp,
            ConvTemplate.Email email, ConvTemplate.Teams teams, List<ConvTemplate.Param> params) {

        public TemplateRequest(String name, String baseText, ConvTemplate.WhatsApp whatsapp,
                ConvTemplate.Email email, ConvTemplate.Teams teams) {
            this(name, baseText, whatsapp, email, teams, null);
        }

        public TemplateRequest(String name, String baseText, ConvTemplate.WhatsApp whatsapp,
                ConvTemplate.Email email) {
            this(name, baseText, whatsapp, email, null);
        }
    }

    /** A rule, its organization, and the template keys its version in force and its draft use. */
    private record Usage(RuleRef rule, String tenantCode, List<String> templateKeys) {
    }

    private static final java.util.regex.Pattern PARAM_NAME = java.util.regex.Pattern.compile("[A-Za-z0-9_]+");

    /** An unsaved email variant and the values to write it with. */
    public record EmailPreviewRequest(String subject, String html, Map<String, String> values) {
    }

    /**
     * An unsaved Teams card and the values of its variables. {@code data} is the event's data the card's images
     * come from; without it, the values.
     */
    public record TeamsPreviewRequest(ConvTemplate.Teams teams, Map<String, String> values,
            Map<String, Object> data) {
    }

    /** The email as sent: subject, the whole HTML with the layout, and its text. */
    public record EmailPreview(String subject, String html, String text) {
    }

    private static final String NOT_FOUND = "Template not found";

    private final RuleStore rules;
    private final TemplateStore templates;
    private final Clock clock;
    private final NotificationMail layout;

    @Inject
    TemplatesService(RuleStore rules, TemplateStore templates, NotificationMail layout) {
        this(rules, templates, Clock.systemUTC(), layout);
    }

    public TemplatesService(RuleStore rules, TemplateStore templates, Clock clock) {
        this(rules, templates, clock, null);
    }

    TemplatesService(RuleStore rules, TemplateStore templates, Clock clock, NotificationMail layout) {
        this.rules = rules;
        this.templates = templates;
        this.clock = clock;
        this.layout = layout;
    }

    /**
     * Writes an email variant with the given values, inside the layout.
     *
     * @throws IllegalArgumentException when the subject or the HTML does not parse
     */
    public EmailPreview previewEmail(EmailPreviewRequest request) {
        if (request == null || blank(request.html())) {
            throw new IllegalArgumentException("html is required");
        }
        String subject = request.subject() == null ? "" : request.subject();
        Rendered r = NotificationMail.body(subject, request.html(),
                request.values() == null ? Map.of() : request.values());
        return new EmailPreview(r.subject(), layout == null ? r.html() : layout.wrap(r.subject(), r.html()),
                r.text());
    }

    /** The body a Teams step sends with this card: {@code {"type": "message", "attachments": [card]}}. */
    public Map<String, Object> previewTeams(TeamsPreviewRequest request) {
        if (request == null || request.teams() == null) {
            throw new IllegalArgumentException("teams is required");
        }
        List<String> problems = TeamsCard.problems(request.teams());
        if (!problems.isEmpty()) {
            throw new IllegalArgumentException(String.join("; ", problems));
        }
        Map<String, String> values = request.values() == null ? Map.of() : request.values();
        Map<String, Object> data = request.data() == null ? Map.copyOf(values) : request.data();
        return TeamsCard.body(request.teams(), values, data);
    }

    /** The templates the organization's rules can use, its own and the platform's, with its rules that use each. */
    public List<TemplateView> list(String tenantCode) {
        List<Usage> usage = usage(rules.list(tenantCode), false);
        return templates.visible(tenantCode).stream().map(t -> view(t, usage)).toList();
    }

    public TemplateView get(String tenantCode, String key) {
        ConvTemplate t = templates.resolve(tenantCode, key)
                .orElseThrow(() -> new NoSuchElementException(NOT_FOUND));
        return view(t, usage(rules.list(tenantCode), false));
    }

    /**
     * The platform's templates, each with the rules that use it, of every organization that has no template of its
     * own with that key.
     */
    public List<TemplateView> platformList() {
        List<Usage> usage = platformUsage();
        return templates.list(PLATFORM_TENANT).stream().map(t -> view(t, usage)).toList();
    }

    public TemplateView platformGet(String key) {
        return view(template(key), platformUsage());
    }

    /** Creates or replaces a platform template; a new one is 0.1.0, a changed one is bumped, an equal one kept. */
    public TemplateView save(String key, TemplateRequest body, String actor) {
        saveIn(PLATFORM_TENANT, key, body, actor);
        return platformGet(key);
    }

    /**
     * Creates or replaces one of the organization's own templates. It has no WhatsApp variant, since that sends a
     * Meta template approved on the platform's account, and its key is not one of the platform's.
     */
    public TemplateView saveOwn(String tenantCode, String key, TemplateRequest body, String actor) {
        if (PLATFORM_TENANT.equals(tenantCode)) {
            return save(key, body, actor);
        }
        if (body != null && body.whatsapp() != null) {
            throw new IllegalArgumentException("An organization's template has no WhatsApp variant");
        }
        if (templates.find(PLATFORM_TENANT, key).isPresent()) {
            throw new IllegalArgumentException("La plantilla " + key + " es de la plataforma; usa otra clave");
        }
        saveIn(tenantCode, key, body, actor);
        return get(tenantCode, key);
    }

    /**
     * Deletes a template no rule uses: the organization's own, or in the platform scope the platform's.
     *
     * @throws IllegalStateException when a rule's version in force or draft uses it
     */
    public void delete(String tenantCode, String key) {
        if (CallPermissionService.TEMPLATE_KEY.equals(key)) {
            throw new IllegalArgumentException("The call permission template cannot be deleted");
        }
        boolean platform = PLATFORM_TENANT.equals(tenantCode);
        ConvTemplate t = templates.find(platform ? PLATFORM_TENANT : tenantCode, key)
                .orElseThrow(() -> new NoSuchElementException(NOT_FOUND));
        List<RuleRef> usedBy = view(t, platform ? platformUsage() : usage(rules.list(tenantCode), false)).usedBy();
        if (!usedBy.isEmpty()) {
            throw new IllegalStateException("La plantilla " + key + " la usan " + usedBy.size()
                    + " reglas; cámbialas antes de borrarla");
        }
        templates.delete(t.tenantCode(), key);
    }

    private void saveIn(String tenantCode, String key, TemplateRequest body, String actor) {
        RulesService.requireKey(key);
        if (body == null || body.name() == null || body.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (body.whatsapp() != null && blank(body.whatsapp().metaName())) {
            throw new IllegalArgumentException("whatsapp.metaName is required");
        }
        if (body.email() != null && (blank(body.email().subject())
                || (blank(body.email().body()) && blank(body.email().html())))) {
            throw new IllegalArgumentException("email.subject and email.html are required");
        }
        if (body.email() != null && body.email().hasHtml()) {
            // Fails here, not on the first send, when the HTML or the subject does not parse.
            NotificationMail.body(body.email().subject(), body.email().html(), Map.of());
        }
        if (body.teams() != null) {
            List<String> problems = TeamsCard.problems(body.teams());
            if (!problems.isEmpty()) {
                throw new IllegalArgumentException(String.join("; ", problems));
            }
        }
        List<ConvTemplate.Param> params = params(body);
        if (!params.isEmpty() && body.whatsapp() != null) {
            throw new IllegalArgumentException("A template with parameters has no WhatsApp variant");
        }
        requireCallPermissionMarker(key, body);
        Instant now = clock.instant();
        Optional<ConvTemplate> existing = templates.find(tenantCode, key);
        ConvTemplate next = new ConvTemplate(existing.map(ConvTemplate::id).orElse(UUID.randomUUID().toString()),
                tenantCode, key, body.name().trim(), body.baseText(), body.whatsapp(), body.email(),
                body.teams(), existing.map(ConvTemplate::createdAt).orElse(now), now, actor, RuleBump.FIRST, params);
        if (existing.isPresent()) {
            RuleBump bump = TemplateBump.between(existing.get(), next);
            if (bump == null) {
                return;
            }
            next = new ConvTemplate(next.id(), next.tenantCode(), key, next.name(), next.baseText(), next.whatsapp(),
                    next.email(), next.teams(), next.createdAt(), now, actor, bump.next(existing.get().version()),
                    params);
        }
        templates.upsert(next, existing.map(ConvTemplate::version).orElse(null))
                .orElseThrow(() -> new IllegalStateException(
                        "La plantilla cambió mientras se guardaba; vuelve a guardarla"));
    }

    /** The parameters, trimmed; each needs a name of letters, digits and {@code _}, not repeated. */
    private static List<ConvTemplate.Param> params(TemplateRequest body) {
        if (body.params() == null) {
            return List.of();
        }
        List<ConvTemplate.Param> out = new ArrayList<>();
        java.util.Set<String> names = new java.util.HashSet<>();
        for (ConvTemplate.Param p : body.params()) {
            String name = p == null || p.name() == null ? "" : p.name().trim();
            if (!PARAM_NAME.matcher(name).matches()) {
                throw new IllegalArgumentException("each parameter needs a name of letters, digits and _");
            }
            if (!names.add(name)) {
                throw new IllegalArgumentException("parameter " + name + " is repeated");
            }
            String label = p.label() == null || p.label().isBlank() ? null : p.label().trim();
            out.add(new ConvTemplate.Param(name, label, p.multiline()));
        }
        return out;
    }

    private static void requireCallPermissionMarker(String key, TemplateRequest body) {
        if (CallPermissionService.TEMPLATE_KEY.equals(key)
                && (body.whatsapp() == null || !body.whatsapp().callPermission())) {
            throw new IllegalArgumentException("The call permission template must retain whatsapp.callPermission");
        }
    }

    private ConvTemplate template(String key) {
        return templates.find(PLATFORM_TENANT, key)
                .orElseThrow(() -> new NoSuchElementException(NOT_FOUND));
    }

    /** Every organization's rules, without those whose organization has its own template of the key. */
    private List<Usage> platformUsage() {
        List<Usage> all = usage(rules.listAll(), true);
        Map<String, java.util.Set<String>> own = new java.util.HashMap<>();
        return all.stream().map(u -> {
            java.util.Set<String> keys = own.computeIfAbsent(u.tenantCode(), tenant -> templates.list(tenant)
                    .stream().map(ConvTemplate::key).collect(Collectors.toSet()));
            return new Usage(u.rule(), u.tenantCode(),
                    u.templateKeys().stream().filter(k -> !keys.contains(k)).toList());
        }).toList();
    }

    private List<Usage> usage(List<Rule> list, boolean withTenant) {
        Map<String, List<RuleVersion>> live = rules.liveVersions(list.stream().map(Rule::id).toList()).stream()
                .collect(Collectors.groupingBy(RuleVersion::ruleId));
        List<Usage> out = new ArrayList<>();
        for (Rule r : list) {
            List<RuleVersion> versions = live.getOrDefault(r.id(), List.of());
            List<String> keys = new ArrayList<>();
            String event = null;
            // The draft first: its event is the one the rule will listen to next.
            for (RuleVersion v : new RuleVersion[] {RulesService.draft(versions), RulesService.current(r, versions)}) {
                if (v != null) {
                    RuleSpec spec = RuleSpec.read(v.spec());
                    spec.steps().forEach(s -> keys.add(s.template()));
                    if (event == null && spec.trigger() != null) {
                        event = spec.trigger().event();
                    }
                }
            }
            out.add(new Usage(new RuleRef(r.id(), r.key(), r.name(), r.state(), event,
                    withTenant ? r.tenantCode() : null), r.tenantCode(), keys));
        }
        return out;
    }

    private static TemplateView view(ConvTemplate t, List<Usage> usage) {
        List<RuleRef> usedBy = usage.stream().filter(u -> u.templateKeys().contains(t.key())).map(Usage::rule)
                .toList();
        return new TemplateView(t.id(), t.key(), t.name(), t.baseText(), t.whatsapp(), t.email(), t.teams(),
                t.params(), t.owner(), t.version(), t.updatedAt(), t.updatedBy(), usedBy);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
