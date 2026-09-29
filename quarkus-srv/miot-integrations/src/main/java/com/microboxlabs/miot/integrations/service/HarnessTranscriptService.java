package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.HarnessThread;
import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.domain.ShareLink;
import com.microboxlabs.miot.integrations.dto.TranscriptDtos.ToolSummary;
import com.microboxlabs.miot.integrations.dto.TranscriptDtos.Transcript;
import com.microboxlabs.miot.integrations.dto.TranscriptDtos.TranscriptMessage;
import com.microboxlabs.miot.integrations.persistence.HarnessThreadRepository;
import com.microboxlabs.miot.integrations.persistence.ShareLinkRepository;
import io.vertx.core.json.Json;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Turns an organization's chat thread into a compact transcript a trainer's
 * learning session can read: text and tool calls only, reasoning dropped,
 * tool arguments and results cut short, and the oldest turns left out once
 * the whole passes {@link #MAX_CHARS}.
 *
 * <p>The thread is named by its id or by a share-link token, and must belong to
 * the caller's tenant. By id it must also be the caller's own or shared with
 * them; an active link already shares its thread with the whole organization.
 */
@ApplicationScoped
public class HarnessTranscriptService {

    static final int MAX_CHARS = 60_000;
    static final int MAX_ARGS_CHARS = 300;
    static final int MAX_RESULT_CHARS = 500;

    private static final int PAGE = 1_000;
    private static final String ELLIPSIS = "…";
    private static final Pattern UUID_SHAPE = Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern TOKEN_SHAPE = Pattern.compile("[A-Za-z0-9_-]{16,64}");

    private final HarnessThreadRepository threads;
    private final ShareLinkRepository links;

    @Inject
    public HarnessTranscriptService(HarnessThreadRepository threads, ShareLinkRepository links) {
        this.threads = threads;
        this.links = links;
    }

    /** Null when {@code ref} names no live thread of the tenant that {@code userId} may read. */
    public Transcript transcript(String tenantCode, String userId, String ref) {
        HarnessThread thread = resolve(tenantCode, userId, ref);
        if (thread == null) {
            return null;
        }
        List<TranscriptMessage> all = new ArrayList<>();
        for (HarnessThreadMessage message : activeBranch(allMessages(thread.id()))) {
            TranscriptMessage compact = compact(message.payload());
            if (compact != null) {
                all.add(compact);
            }
        }
        return capped(thread, all);
    }

    private HarnessThread resolve(String tenantCode, String userId, String ref) {
        if (ref == null || ref.isBlank()) {
            return null;
        }
        if (UUID_SHAPE.matcher(ref).matches()) {
            HarnessThread thread = threads.find(ref, tenantCode);
            return thread != null && readable(thread, userId) ? thread : null;
        }
        if (!TOKEN_SHAPE.matcher(ref).matches()) {
            return null;
        }
        ShareLink link = links.findActive(ref, tenantCode);
        if (link == null || !ShareLink.THREAD.equals(link.targetType())) {
            return null;
        }
        return threads.find(link.targetId(), tenantCode);
    }

    /** By id, the same rule as reading a thread: the caller owns it or it is shared with them. */
    private boolean readable(HarnessThread thread, String userId) {
        return Objects.equals(thread.ownerId(), userId)
                || threads.listShares(thread.id()).stream()
                        .anyMatch(share -> Objects.equals(share.principal(), userId));
    }

    private List<HarnessThreadMessage> allMessages(String threadId) {
        List<HarnessThreadMessage> all = new ArrayList<>();
        long after = 0;
        List<HarnessThreadMessage> page;
        do {
            page = threads.listMessages(threadId, after, PAGE);
            all.addAll(page);
            if (!page.isEmpty()) {
                after = page.get(page.size() - 1).seq();
            }
        } while (page.size() == PAGE);
        return all;
    }

    /**
     * The branch the thread ends on: the last stored message and its ancestors.
     * A thread stored without parent links is read in append order.
     */
    static List<HarnessThreadMessage> activeBranch(List<HarnessThreadMessage> messages) {
        if (messages.isEmpty() || messages.stream().allMatch(m -> m.parentId() == null)) {
            return messages;
        }
        Map<String, HarnessThreadMessage> byId = new HashMap<>();
        for (HarnessThreadMessage message : messages) {
            byId.put(message.id(), message);
        }
        Deque<HarnessThreadMessage> chain = new ArrayDeque<>();
        Set<String> seen = new HashSet<>();
        HarnessThreadMessage current = messages.get(messages.size() - 1);
        while (current != null && seen.add(current.id())) {
            chain.addFirst(current);
            current = current.parentId() == null ? null : byId.get(current.parentId());
        }
        return new ArrayList<>(chain);
    }

    /** One assistant-ui message as role, text and tool calls; null when it says nothing. */
    static TranscriptMessage compact(Map<String, Object> payload) {
        if (payload == null) {
            return null;
        }
        String role = Objects.toString(payload.get("role"), "unknown");
        Object content = payload.get("content");
        StringBuilder text = new StringBuilder();
        List<ToolSummary> tools = new ArrayList<>();
        if (content instanceof String plain) {
            text.append(plain);
        } else if (content instanceof List<?> parts) {
            for (Object part : parts) {
                if (part instanceof Map<?, ?> map) {
                    addPart(map, text, tools);
                }
            }
        }
        if (text.isEmpty() && tools.isEmpty()) {
            return null;
        }
        return new TranscriptMessage(role, text.toString(), List.copyOf(tools));
    }

    private static void addPart(Map<?, ?> part, StringBuilder text, List<ToolSummary> tools) {
        Object type = part.get("type");
        if ("text".equals(type) && part.get("text") instanceof String value && !value.isBlank()) {
            if (!text.isEmpty()) {
                text.append("\n\n");
            }
            text.append(value);
        } else if ("tool-call".equals(type)) {
            Object args = part.get("args") != null ? part.get("args") : part.get("argsText");
            tools.add(new ToolSummary(
                    Objects.toString(part.get("toolName"), "tool"),
                    summary(args, MAX_ARGS_CHARS),
                    summary(part.get("result"), MAX_RESULT_CHARS)));
        }
    }

    static String summary(Object value, int max) {
        if (value == null) {
            return null;
        }
        String text = value instanceof String s ? s : Json.encode(value);
        return cut(text, max);
    }

    private static String cut(String text, int max) {
        if (text.codePointCount(0, text.length()) <= max) {
            return text;
        }
        return text.substring(0, text.offsetByCodePoints(0, max - 1)) + ELLIPSIS;
    }

    /** Keeps the newest messages that fit in {@link #MAX_CHARS}; the newest is cut rather than dropped. */
    static Transcript capped(HarnessThread thread, List<TranscriptMessage> messages) {
        Deque<TranscriptMessage> kept = new ArrayDeque<>();
        int budget = MAX_CHARS;
        for (int i = messages.size() - 1; i >= 0; i--) {
            TranscriptMessage message = messages.get(i);
            int size = size(message);
            if (size <= budget) {
                kept.addFirst(message);
                budget -= size;
            } else {
                if (kept.isEmpty()) {
                    int room = Math.max(1, budget - (size - message.text().length()));
                    kept.addFirst(new TranscriptMessage(
                            message.role(), cut(message.text(), room), message.tools()));
                }
                break;
            }
        }
        return new Transcript(thread.id(), thread.title(), List.copyOf(kept), messages.size() - kept.size());
    }

    private static int size(TranscriptMessage message) {
        int size = message.text().length();
        for (ToolSummary tool : message.tools()) {
            size += tool.name().length() + length(tool.argsSummary()) + length(tool.resultSummary());
        }
        return size;
    }

    private static int length(String value) {
        return value == null ? 0 : value.length();
    }
}
