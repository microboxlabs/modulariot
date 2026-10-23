package com.microboxlabs.miot.core.event;

/**
 * What an event is about, such as {@code {kind: "symptom_case", key: "-123"}} or
 * {@code {kind: "service", key: "<service code>"}}. Events with the same kind and key are about the same thing.
 */
public record EventContext(String kind, String key) {
}
