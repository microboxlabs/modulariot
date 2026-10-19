package com.microboxlabs.miot.integrations.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** A compact, text-only transcript of a chat thread, for a trainer's review. */
public final class TranscriptDtos {

    private TranscriptDtos() {
    }

    /**
     * {@code omittedMessages} counts the oldest messages left out to keep the
     * transcript within its size cap.
     */
    public record Transcript(
            @JsonProperty("thread_id") String threadId,
            String title,
            List<TranscriptMessage> messages,
            @JsonProperty("omitted_messages") int omittedMessages) {
    }

    public record TranscriptMessage(String role, String text, List<ToolSummary> tools) {
    }

    public record ToolSummary(
            String name,
            @JsonProperty("args_summary") String argsSummary,
            @JsonProperty("result_summary") String resultSummary) {
    }
}
