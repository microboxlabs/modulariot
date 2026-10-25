package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.conversational.service.InMemoryConversations;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** In-memory rule, template and run stores, with the same rules as the SQL. Messages live in the conversations. */
final class InMemoryRules {

    final InMemoryConversations conversations = new InMemoryConversations();
    final Map<String, Rule> rules = new LinkedHashMap<>();
    final List<RuleVersion> versions = new ArrayList<>();
    final Map<String, ConvTemplate> templates = new LinkedHashMap<>();
    final Map<String, StoredEvent> events = new LinkedHashMap<>();
    final Map<String, Run> runs = new LinkedHashMap<>();
    final Rules ruleStore = new Rules();
    final Templates templateStore = new Templates();
    final Runs runStore = new Runs();

    final class Rules implements RuleStore {
        @Override
        public List<Rule> list(String tenantCode) {
            return rules.values().stream().filter(r -> r.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public List<Rule> listAll() {
            return List.copyOf(rules.values());
        }

        @Override
        public Optional<Rule> find(String tenantCode, String id) {
            return Optional.ofNullable(rules.get(id)).filter(r -> r.tenantCode().equals(tenantCode));
        }

        @Override
        public Rule create(Rule rule) {
            if (list(rule.tenantCode()).stream().anyMatch(r -> r.key().equals(rule.key()))) {
                throw new IllegalStateException("Ya existe una regla con la clave " + rule.key());
            }
            rules.put(rule.id(), rule);
            return rule;
        }

        @Override
        public Optional<Rule> updateState(String tenantCode, String id, Rule.State state, Instant at) {
            return find(tenantCode, id).map(r -> {
                Rule updated = r.withState(state, at);
                rules.put(id, updated);
                return updated;
            });
        }

        @Override
        /** The draft first, then the published versions, newest first, like the SQL. */
        public List<RuleVersion> versions(String ruleId) {
            List<RuleVersion> out = new ArrayList<>(versions.stream().filter(v -> v.ruleId().equals(ruleId))
                    .filter(v -> v.status() == RuleVersion.Status.DRAFT).toList());
            List<RuleVersion> published = new ArrayList<>(versions.stream()
                    .filter(v -> v.ruleId().equals(ruleId) && v.status() == RuleVersion.Status.PUBLISHED).toList());
            java.util.Collections.reverse(published);
            out.addAll(published);
            return out;
        }

        @Override
        public Optional<RuleVersion> version(String ruleId, String version) {
            return versions.stream().filter(v -> v.ruleId().equals(ruleId) && version.equals(v.version()))
                    .findFirst();
        }

        @Override
        public List<RuleVersion> liveVersions(List<String> ruleIds) {
            List<RuleVersion> out = new ArrayList<>();
            for (String id : ruleIds) {
                List<RuleVersion> all = versions(id);
                Rule r = rules.get(id);
                all.stream().filter(v -> v.status() == RuleVersion.Status.DRAFT
                        || (r.currentVersion() != null && r.currentVersion().equals(v.version()))).forEach(out::add);
            }
            return out;
        }

        @Override
        public RuleVersion saveDraft(String ruleId, JsonNode spec, String actor, Instant at) {
            versions.removeIf(v -> v.ruleId().equals(ruleId) && v.status() == RuleVersion.Status.DRAFT);
            RuleVersion draft = new RuleVersion(UUID.randomUUID().toString(), ruleId, null, null,
                    RuleVersion.Status.DRAFT, spec, null, at, actor);
            versions.add(draft);
            return draft;
        }

        @Override
        public boolean discardDraft(String ruleId) {
            return versions.removeIf(v -> v.ruleId().equals(ruleId) && v.status() == RuleVersion.Status.DRAFT);
        }

        @Override
        public Optional<RuleVersion> publish(String ruleId, JsonNode validated, Publication p) {
            String version = p.version();
            Instant at = p.at();
            if (!java.util.Objects.equals(rules.get(ruleId).currentVersion(), p.from())) {
                return Optional.empty();
            }
            Optional<RuleVersion> draft = versions.stream()
                    .filter(v -> v.ruleId().equals(ruleId) && v.status() == RuleVersion.Status.DRAFT
                            && v.spec().equals(validated)).findFirst();
            if (draft.isEmpty()) {
                return Optional.empty();
            }
            RuleVersion published = new RuleVersion(draft.get().id(), ruleId, version, p.bump(),
                    RuleVersion.Status.PUBLISHED, draft.get().spec(), p.reason(), at, p.actor());
            versions.remove(draft.get());
            versions.add(published);
            Rule r = rules.get(ruleId);
            rules.put(ruleId, new Rule(r.id(), r.tenantCode(), r.key(), r.name(), r.state(), version, r.createdAt(),
                    at));
            return Optional.of(published);
        }

        @Override
        public List<InForce> inForce(String tenantCode) {
            List<InForce> out = new ArrayList<>();
            for (Rule r : list(tenantCode)) {
                if (r.state() != Rule.State.OFF && r.currentVersion() != null) {
                    out.add(new InForce(r, version(r.id(), r.currentVersion()).orElseThrow()));
                }
            }
            return out;
        }
    }

    final class Templates implements TemplateStore {
        @Override
        public List<ConvTemplate> list(String tenantCode) {
            return templates.values().stream().filter(t -> t.tenantCode().equals(tenantCode))
                    .sorted(Comparator.comparing(ConvTemplate::key)).toList();
        }

        @Override
        public Optional<ConvTemplate> find(String tenantCode, String key) {
            return Optional.ofNullable(templates.get(tenantCode + "/" + key));
        }

        @Override
        public Optional<ConvTemplate> upsert(ConvTemplate t, String expectedVersion) {
            ConvTemplate existing = templates.get(t.tenantCode() + "/" + t.key());
            if (existing != null && !java.util.Objects.equals(existing.version(), expectedVersion)) {
                return Optional.empty();
            }
            ConvTemplate saved = existing == null ? t : new ConvTemplate(existing.id(), t.tenantCode(), t.key(),
                    t.name(), t.baseText(), t.whatsapp(), t.email(), existing.createdAt(), t.updatedAt(),
                    t.updatedBy(), t.version());
            templates.put(t.tenantCode() + "/" + t.key(), saved);
            return Optional.of(saved);
        }
    }

    final class Runs implements RunStore {
        @Override
        public StoredEvent saveEvent(StoredEvent event) {
            events.put(event.id(), event);
            return event;
        }

        @Override
        public Optional<StoredEvent> event(String id) {
            return Optional.ofNullable(events.get(id));
        }

        @Override
        public Run createRun(Run run) {
            runs.put(run.id(), run);
            if (run.status() == Run.Status.WAITING) {
                conversations.waitingRuns.add(run.id());
            }
            return run;
        }

        @Override
        public Optional<Run> find(String id) {
            return Optional.ofNullable(runs.get(id));
        }

        @Override
        public List<Run> claimDue(Instant now, Duration lease, int limit) {
            List<Run> due = runs.values().stream()
                    .filter(r -> r.status() == Run.Status.WAITING && r.nextAt() != null && !r.nextAt().isAfter(now))
                    .sorted(Comparator.comparing(Run::nextAt)).limit(limit).toList();
            due.forEach(r -> runs.put(r.id(), r.advanced(r.status(), r.step(), now.plus(lease), r.lastError(), now)));
            return due.stream().map(r -> runs.get(r.id())).toList();
        }

        @Override
        public boolean updateIfWaiting(Run run) {
            Run current = runs.get(run.id());
            if (current == null || current.status() != Run.Status.WAITING) {
                return false;
            }
            runs.put(run.id(), run);
            if (run.status() != Run.Status.WAITING) {
                conversations.waitingRuns.remove(run.id());
            }
            return true;
        }

        @Override
        public List<Run> waiting(String tenantCode, String contextKind, String contextKey) {
            return runs.values().stream().filter(r -> r.tenantCode().equals(tenantCode)
                    && r.status() == Run.Status.WAITING && contextKind.equals(r.contextKind())
                    && contextKey.equals(r.contextKey())).toList();
        }

        @Override
        public Optional<Run> waitingOnConversation(String tenantCode, String conversationId) {
            return conversations.messages.stream()
                    .filter(m -> m.runId() != null && m.conversationId().equals(conversationId)
                            && m.status() != MessageStatus.SIMULATED && m.status() != MessageStatus.FAILED)
                    .map(m -> runs.get(m.runId()))
                    .filter(r -> r != null && r.status() == Run.Status.WAITING && !r.test()
                            && r.tenantCode().equals(tenantCode))
                    .reduce((a, b) -> b);
        }

        @Override
        public List<RunRow> list(String tenantCode, String ruleId, Run.Status status, int limit) {
            return runs.values().stream()
                    .filter(r -> r.tenantCode().equals(tenantCode) && (ruleId == null || r.ruleId().equals(ruleId))
                            && (status == null || r.status() == status))
                    .sorted(Comparator.comparing(Run::createdAt).reversed()).limit(limit)
                    .map(r -> {
                        StoredEvent e = events.get(r.eventId());
                        return new RunRow(r, rules.get(r.ruleId()).name(), e.type(), text(e, "symptomName"),
                                text(e, "assetId"));
                    })
                    .toList();
        }

        @Override
        public List<RunMessage> messages(Collection<String> runIds) {
            List<RunMessage> out = new ArrayList<>();
            for (Message m : conversations.messages) {
                if (m.runId() != null && runIds.contains(m.runId())) {
                    Conversation c = conversations.conversations.get(m.conversationId());
                    out.add(new RunMessage(m.id(), m.runId(), m.step(), m.channel().dbValue(), m.address(),
                            c == null ? null : c.displayName(), m.status().name(), m.body(), m.createdAt().toInstant()));
                }
            }
            return out;
        }

        private static String text(StoredEvent e, String field) {
            Object value = e.data().get(field);
            return value == null ? null : value.toString();
        }
    }
}
