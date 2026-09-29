package com.microboxlabs.miot.integrations.dto;

/** Edits a pending candidate's term and body before review. Both are required. */
public record CandidateEditRequest(String term, String body) {
}
